# Salão App

Aplicação web para cadastro, login e gestão básica de agendamentos de um salão de beleza.

## Como executar

O projeto foi ajustado para usar Supabase Cloud diretamente no frontend. Com isso, ele pode ser aberto sem Node.js local, o que é adequado para ambientes corporativos com restrições de instalação.

1. Configure no Supabase:

   - Auth com email/senha ativado
   - Tabelas public.saloes, public.agendamentos e public.pagamentos criadas
   - Políticas RLS aplicadas

2. Abra o arquivo index.html ou publique os arquivos em qualquer hospedagem estática.

3. Faça cadastro e login normalmente.

## Integração atual

- O frontend usa Supabase Auth para cadastro e login.
- Os dados do salão, agendamentos e pagamentos são salvos no banco do Supabase.
- Não há mais dependência de MongoDB, JSONBin ou Node.js para uso básico da aplicação.

## Estrutura atual

```text
.
├── api/
│   ├── cadastro.js
│   └── login.js
├── index.html
├── src/
│   ├── pages/
│   │   ├── cadastro.html
│   │   └── principal.html
│   ├── scripts/
│   │   ├── auth.js
│   │   ├── cadastro.js
│   │   ├── login.js
│   │   ├── principal.js
│   │   └── supabase.js
│   └── styles/
│       └── style.css
└── package.json
```

## Observações importantes

- A chave pública do Supabase pode ficar no frontend; a service role nunca deve ser exposta.
- Os arquivos da pasta api ficaram obsoletos após a migração para Supabase Cloud.
- Se quiser publicar o projeto, qualquer hospedagem estática simples atende.