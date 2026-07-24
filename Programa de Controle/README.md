# Sistema de Controle Amazon

Aplicacao web para gestao de estoque, envios para Amazon, compras, DRE, caixa e conta PJ.

## Estrutura atual

- Frontend: `index.html`, `styles.css` e `app.js`, sem framework.
- Backend: `server.py`, usando Python padrao.
- Banco local: `estoque.db` em SQLite.
- Banco online: PostgreSQL quando a variavel `DATABASE_URL` estiver configurada.
- Imagens de produtos e anexos de compras: salvos no banco como texto base64 dentro dos registros JSON. O sistema nao depende de pasta local de uploads.

## O que foi preparado para funcionar online

- Servidor escutando a porta definida pela Railway em `PORT`.
- Suporte a PostgreSQL via `DATABASE_URL`.
- Fallback para SQLite quando rodar localmente sem `DATABASE_URL`.
- Login com cookie seguro.
- Usuarios com perfil de acesso.
- Auditoria de acoes importantes no banco.
- Exclusao logica para registros principais, preservando historico.
- Scripts de migracao, criacao de tabelas, seed de administrador e migracao do SQLite antigo.
- Arquivos de deploy: `requirements.txt`, `railway.json`, `Procfile` e `.env.example`.

## Perfis de usuario

- `admin`: acesso total.
- `estoque`: produtos, movimentacoes e envios.
- `compras`: compras e recebimentos.
- `financeiro`: DRE, caixa e conta.
- `consulta`: somente leitura.

As permissoes sao validadas no backend. A interface pode exibir os botoes, mas o servidor bloqueia a acao quando o usuario nao tem permissao.

## Variaveis de ambiente

Crie estas variaveis na Railway:

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=uma-chave-grande-e-aleatoria
ADMIN_EMAIL=seu-email@empresa.com
ADMIN_PASSWORD=sua-senha-forte
ADMIN_NAME=Administrador
NODE_ENV=production
REQUIRE_AUTH=true
```

Para uso local, copie `.env.example` para `.env` e preencha somente o que precisar.

## Deploy na Railway

1. Suba esta pasta para um repositorio GitHub.
2. Crie um projeto na Railway.
3. Adicione um banco PostgreSQL ao projeto.
4. Conecte o repositorio do sistema ao Railway.
5. Configure as variaveis de ambiente acima.
6. Aguarde o deploy.
7. Depois do primeiro deploy, rode o comando abaixo no terminal da Railway para criar o usuario administrador:

```bash
python seed_admin.py
```

8. Abra a URL gerada pela Railway e entre com o email e senha definidos em `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

## Migrar dados do computador para a Railway

Se voce ja tem produtos, compras, DRE, caixa e conta no `estoque.db`, use o script de migracao.

No computador ou no terminal da Railway, com `DATABASE_URL` apontando para o banco PostgreSQL:

```bash
python migrate.py
python migrate_data.py
python seed_admin.py
```

O script `migrate_data.py` copia os dados do SQLite para o PostgreSQL e evita duplicar IDs ja existentes.

Se o arquivo SQLite estiver em outro local, informe:

```bash
SQLITE_PATH="Caminho/para/estoque.db" python migrate_data.py
```

## Comandos uteis

Rodar localmente:

```bash
python server.py
```

Criar ou atualizar tabelas:

```bash
python migrate.py
```

Criar administrador inicial:

```bash
python seed_admin.py
```

Validar arquivos principais:

```bash
python -m py_compile server.py migrate.py migrate_data.py seed_admin.py
```

## Observacoes importantes

- Em producao, defina sempre `SESSION_SECRET`; sem isso o servidor nao inicia com PostgreSQL.
- Localmente, sem `DATABASE_URL`, o sistema abre em modo local para manter o atalho funcionando. Na Railway, com PostgreSQL ou `NODE_ENV=production`, o login passa a ser obrigatorio.
- O sistema nao usa armazenamento local para imagens, entao elas continuam disponiveis online junto com os registros do banco.
- O arquivo SQLite local continua sendo util para testes locais, mas a versao online deve usar PostgreSQL.
- A rota `/health` retorna o status do app e do banco para a Railway monitorar.
