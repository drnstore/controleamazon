"""Amazon monthly report parser. Pure calculations; never writes inventory or DREs."""
import csv
import hashlib
import io
import re
import unicodedata
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation


INVALID = "Este arquivo não parece ser um Relatório Unificado de Transações da Amazon."
VERSION = 1


def norm(value):
    return " ".join(unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode().lower().strip().split())


ALIASES = {
    "date": ["data/hora", "date/time"],
    "type": ["tipo", "type"],
    "sku": ["sku"],
    "description": ["descrição", "description"],
    "quantity": ["quantidade", "quantity"],
    "sales": ["vendas do produto", "product sales"],
    "shipping": ["créditos de remessa", "shipping credits"],
    "gift": ["créditos de embalagem de presente", "gift wrap credits", "giftwrap credits"],
    "promo": ["descontos promocionais", "promotional rebates"],
    "selling": ["tarifas de venda", "selling fees"],
    "fba": ["taxas fba", "fba fees"],
    "fees": ["taxas de outras transações", "outras taxas de transação", "other transaction fees"],
    "other": ["outro", "outros", "other"],
    "total": ["total"],
}
MONTHS = {name: i for i, names in enumerate([
    "jan january janeiro", "feb february fev fevereiro", "mar march marco", "apr april abr abril",
    "may maio", "jun june junho", "jul july julho", "aug august ago agosto",
    "sep sept september set setembro", "oct october out outubro", "nov november novembro",
    "dec december dez dezembro"], 1) for name in names.split()}
FIELDS = {
    "gross": ("Faturamento de Produtos", "income"),
    "shipping": ("Fretes recebidos", "income"),
    "gift": ("Embalagem de presente", "income"),
    "rewards": ("Seller Rewards", "income"),
    "inventory": ("Reembolso / Crédito de Estoque FBA", "income"),
    "selling": ("Comissão / Taxas de Venda Amazon", "expense"),
    "fba": ("Logística Amazon / FBA", "expense"),
    "ads": ("Amazon Ads", "expense"),
    "subscription": ("Taxa de Cadastro Amazon", "expense"),
    "refunds": ("Reembolso de Clientes", "expense"),
    "shipping_refunds": ("Fretes devolvidos", "expense"),
    "promo": ("Descontos promocionais líquidos", "expense"),
    "other_fees": ("Outras taxas Amazon", "expense"),
}


def cents(value, comma_decimal):
    value = str(value).strip().replace("\u00a0", "").replace(" ", "")
    if not value:
        return 0
    if comma_decimal:
        value = value.replace(".", "").replace(",", ".")
    else:
        value = value.replace(",", "")
    try:
        result = Decimal(value) * 100
        if not result.is_finite() or result != result.to_integral_value() or abs(result) > 10**14:
            raise ValueError("Valor monetário inválido.")
        return int(result)
    except InvalidOperation as error:
        raise ValueError("Valor monetário inválido.") from error


def transaction_date(value):
    text = norm(value).replace(".", "")
    pt = re.search(r"(\d{1,2}) de ([a-z]+) de (\d{4})", text)
    en = re.search(r"([a-z]+) (\d{1,2}),? (\d{4})", text)
    iso = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if pt:
        day, mon, year = pt.groups()
        month = MONTHS.get(mon)
    elif en:
        mon, day, year = en.groups()
        month = MONTHS.get(mon)
    elif iso:
        year, month, day = map(int, iso.groups())
    else:
        raise ValueError("Data de transação não reconhecida: " + value)
    if not month:
        raise ValueError("Mês da transação não reconhecido.")
    clock = re.search(r"(\d{1,2}):(\d{2}):(\d{2})(?:\s*(am|pm))?", text)
    hour, minute, second = map(int, clock.groups()[:3]) if clock else (0, 0, 0)
    if clock and clock[4]:
        hour = hour % 12 + (12 if clock[4] == "pm" else 0)
    zone = re.search(r"(?:gmt|utc)\s*([+-]\d{1,2})(?::?(\d{2}))?", text)
    offset = None
    if zone:
        offset = int(zone[1]) * 60 + (int(zone[2] or 0) * (-1 if zone[1].startswith("-") else 1))
    else:
        for name, hours in {"pdt": -7, "pst": -8, "brt": -3, "utc": 0}.items():
            if re.search(r"\b" + name + r"\b", text):
                offset = hours * 60
    date = datetime(int(year), int(month), int(day), hour, minute, second)
    # Financial period is Brazil/São Paulo (UTC-3 since 2019), not UTC.
    financial = date if offset is None else date.replace(tzinfo=timezone(timedelta(minutes=offset))).astimezone(timezone(timedelta(hours=-3)))
    return date.isoformat(), financial.strftime("%Y-%m"), offset


def classify(kind, description):
    if kind in {"pedido", "order"}:
        return "order"
    if kind in {"reembolso", "refund"}:
        return "refund"
    if kind in {"transferir", "transfer", "disbursement"}:
        return "transfer"
    if kind in {"recompensa do vendedor", "seller reward", "seller rewards"} or description in {"recompensa do vendedor", "seller reward", "seller rewards"}:
        return "rewards"
    if kind in {"ajuste", "adjustment"} and (description.startswith("reembolso de estoque fba") or description.startswith("fba inventory reimbursement")):
        return "inventory"
    if kind in {"taxa de servico", "service fee"}:
        if description in {"custo de publicidade", "cost of advertising", "advertising cost"}:
            return "ads"
        if description in {"cadastro", "subscription", "subscription fee", "registration"}:
            return "subscription"
    if kind in {"tarifas de transacao com fba - logistica da amazon", "fba inventory fee"} and any(x in description for x in ["tarifa de devolucao de inventario", "tarifa de armazenamento", "storage fee", "removal fee", "disposal fee"]):
        return "fba_extra"
    return "unknown"


def parse_report(content, filename, selected_month=None):
    if not isinstance(content, str) or len(content.encode("utf-8")) > 12_000_000:
        raise ValueError("O CSV deve ter no máximo 12 MB.")
    all_rows = None
    mapping = None
    for delimiter in [",", ";", "\t"]:
        try:
            rows = list(csv.reader(io.StringIO(content.lstrip("\ufeff")), delimiter=delimiter, strict=True))
        except csv.Error:
            continue
        for index, row in enumerate(rows[:50]):
            header = [norm(c) for c in row]
            mapped = {key: next((header.index(norm(alias)) for alias in aliases if norm(alias) in header), None) for key, aliases in ALIASES.items()}
            if all(v is not None for v in mapped.values()):
                all_rows, mapping, header_size = rows[index + 1:], mapped, len(header)
                comma_decimal = norm(row[mapped["sales"]]) == "vendas do produto"
                break
        if mapping:
            break
    if mapping is None:
        raise ValueError(INVALID)
    totals = {key: 0 for key in FIELDS}
    breakdown = {key: {"credits": 0, "charges": 0} for key in FIELDS}
    unknown, transfers, sku_units, dates, months, offsets = [], [], {}, [], Counter(), set()
    count = 0

    def add(key, signed):
        # Signed in economic direction: credits +, charges -.
        breakdown[key]["credits" if signed >= 0 else "charges"] += abs(signed)
        totals[key] += signed if FIELDS[key][1] == "income" else -signed

    for row in all_rows:
        if not any(c.strip() for c in row):
            continue
        count += 1
        if len(row) != header_size:
            raise ValueError(f"Linha {count}: número de colunas inválido.")
        r = {key: row[index].strip() for key, index in mapping.items()}
        date, month, offset = transaction_date(r["date"])
        dates.append(date)
        months[month] += 1
        offsets.add(offset)
        money = {key: cents(r[key], comma_decimal) for key in ["sales", "shipping", "gift", "promo", "selling", "fba", "fees", "other", "total"]}
        kind = classify(norm(r["type"]), norm(r["description"]))
        if kind in {"unknown", "transfer"}:
            (unknown if kind == "unknown" else transfers).append({"type": r["type"], "description": r["description"], "total": money["total"], "line": count})
            continue
        if kind in {"order", "refund"}:
            try:
                quantity = int(r["quantity"] or "0")
                if quantity < 0:
                    raise ValueError()
            except ValueError as error:
                raise ValueError(f"Linha {count}: quantidade inválida.") from error
            sku = r["sku"]
            units = sku_units.setdefault(sku, {"sku": sku, "sold": 0, "refunded": 0, "net": 0})
            units["sold" if kind == "order" else "refunded"] += quantity
            units["net"] += quantity if kind == "order" else -quantity
            add("gross" if kind == "order" else "refunds", money["sales"] if kind == "order" else -abs(money["sales"]))
            add("shipping" if kind == "order" else "shipping_refunds", money["shipping"])
            add("gift", money["gift"])
            add("promo", money["promo"])
            add("selling", money["selling"])
            add("fba", money["fba"])
            add("other_fees", money["fees"])
            # Nonstandard residuals (including taxes) are explicit, never guessed.
            residual = money["total"] - sum(money[k] for k in ["sales", "shipping", "gift", "promo", "selling", "fba", "fees"])
            if residual:
                unknown.append({"type": r["type"], "description": "Parcela não classificada: " + r["description"], "total": residual, "line": count})
        else:
            # Total represents the actual transaction exactly once, regardless of its column.
            add("fba" if kind == "fba_extra" else kind, money["total"])
    if not count:
        raise ValueError("O arquivo não contém transações.")
    if len(months) != 1:
        raise ValueError("O arquivo contém mais de um mês financeiro (horário de Brasília): " + ", ".join(sorted(months)))
    month = next(iter(months))
    if selected_month and selected_month != month:
        raise ValueError(f"O relatório pertence a {month}, diferente do mês selecionado.")
    net = totals["gross"] + totals["shipping"] + totals["gift"] - totals["refunds"] - totals["shipping_refunds"] - totals["promo"]
    result = net - sum(totals[k] for k in ["selling", "fba", "ads", "subscription", "other_fees"]) + totals["rewards"] + totals["inventory"]
    lines = []
    for key, value in totals.items():
        label, side = FIELDS[key]
        if value < 0:
            side = "expense" if side == "income" else "income"
            label += " (ajuste líquido)"
        lines.append({"id": "amazon:" + key, "label": label, "cents": abs(value), "side": side, "source": "amazon_csv"})
    return {"source": "amazon_csv", "parserVersion": VERSION, "file": str(filename)[:255],
            "hash": hashlib.sha256(content.encode("utf-8")).hexdigest(), "month": month,
            "reference_month": int(month[5:]), "reference_year": int(month[:4]),
            "transactions": count, "dateRange": [min(dates), max(dates)],
            "timezone": "America/Sao_Paulo (UTC-3)", "reportOffsetsMinutes": sorted(offsets, key=lambda v: -9999 if v is None else v),
            "totals": totals, "breakdown": breakdown, "lines": lines, "netRevenue": net,
            "beforeCogs": result, "amazonFees": totals["selling"] + totals["fba"],
            "unknown": unknown, "transfers": transfers, "skuUnits": list(sku_units.values())}
