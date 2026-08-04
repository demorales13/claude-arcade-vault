## Checklist de seguridad básico

  - [ ] RLS: Row Level Security habilitado en tablas: `games`, `profiles` y `scores`
  - [ ] Minimum password length — mínimo 8 caracteres
  - [ ] Leaked password protection — (el warning 4)
  - [ ] Max signup rate — limitar signups por IP (anti-bot)
  - [ ] Headers de seguridad en Next.js
  
  Ej:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// En la config de Next.js:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## Por el lado de Supabase:

- [ ] TODO: vayan al panel de warnings y errores de Supabase


| name                  | title                 | level | facing   | categories   | description                                                                                                                                                                                         | detail                                                                         | remediation                                                                               | metadata                                                    | cache_key                                     |
| --------------------- | --------------------- | ----- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| security_definer_view | Security Definer View | ERROR | EXTERNAL | ["SECURITY"] | Detects views defined with the SECURITY DEFINER property. These views enforce Postgres permissions and row level security policies (RLS) of the view creator, rather than that of the querying user | View \`public.games_with_stats\` is defined with the SECURITY DEFINER property | https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view | {"name":"games_with_stats","type":"view","schema":"public"} | security_definer_view_public_games_with_stats |