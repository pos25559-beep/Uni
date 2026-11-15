# Checklist Google Play Store & Conformidade UE — Unipedia

Este documento reúne os requisitos técnicos, funcionais e legais obrigatórios para publicar **Unipedia** (`com.unipedia.app`) na Google Play Store (União Europeia / Portugal).

## 1. Requisitos Técnicos Android (API 36)
- [x] `compileSdkVersion = 36` e `targetSdkVersion = 36` (`android/variables.gradle`)
- [x] `minSdkVersion = 24` (suporte amplo mantendo segurança moderna)
- [x] `minifyEnabled true` e `shrinkResources true` configurados em `release` (`android/app/build.gradle`)
- [x] Edge-to-Edge com `env(safe-area-inset-*)`, barras do sistema sincronizadas com o tema (`ThemeChromePlugin` + `@capacitor/status-bar`), teclado virtual (`@capacitor/keyboard` + `adjustResize`) e `@capacitor/splash-screen`
- [x] **Modo Foco / Escudo Anti-distração nativo** (`FocusShieldPlugin` em `MainActivity.java`): acesso opcional a *Não Incomodar* (`ACCESS_NOTIFICATION_POLICY`, com restauro automático do filtro anterior em `onDestroy` / fim do bloco) e *App Pinning* do sistema (`startLockTask` / `stopLockTask`), sem serviços de Acessibilidade nem VPN local
- [x] Regras de backup RGPD (`android/app/src/main/res/xml/data_extraction_rules.xml` + `backup_rules.xml`) impedindo cópia não consentida de `app_webview/` e tokens locais
- [x] Portas de qualidade web pré-sync (`npm run check` e `npm run a11y:smoke`) verdes antes de `npm run android:sync`
- [ ] **Assinatura Release**: gerar ou configurar `keystore` de upload fora do repositório (`android/app/keystore.properties` ignorado no `.gitignore`) e construir AAB via `./gradlew bundleRelease`

## 2. Formulário de Segurança de Dados (Play Console -> Data Safety)
A declarar no Google Play Console:
- **A app recolhe ou partilha dados de utilizadores?**
  - Sim, *apenas se* o utilizador ativar voluntariamente a sincronização Firebase ou o Tutor/Prática IA.
  - Em modo 100% local, nenhum dado sai do dispositivo.
- **Tipos de dados tratados quando sincronizado na Cloud (opcional):**
  - *Informações pessoais*: Nome, e-mail institucional/pessoal opcional (autenticação Firebase Auth).
  - *Atividade e conteúdo académico na app*: Cadeiras, tópicos (incluindo estado SRS e cartões de prática), avaliações, sessões de foco (`focusDistractions`, `focusAwaySeconds`, `focusShieldUsed`, `practiceHits`, `practiceTotal`), eventos de calendário, tarefas e registos do Diário do Uni — armazenados exclusivamente em `/users/{uid}` sob validação em `firestore.rules`.
- **Encriptação em trânsito?** Sim (HTTPS / TLS).
- **Pedido de eliminação de conta:**
  - In-app: **Definições → Dados e privacidade → Apagar conta e dados** (`/eliminar-conta`).
  - URL público exigido pelo Play Console: `https://campus-erp-84964.web.app/eliminar-conta`
- **Publicidade / SDKs de rastreio?** Não existem SDKs de anúncios, Analytics comportamental de terceiros ou Ad ID.

## 3. Links Públicos Obrigatórios (Play Store Listing)
- **Política de Privacidade (RGPD)**: `https://campus-erp-84964.web.app/privacidade`
- **Eliminação de Conta & Dados**: `https://campus-erp-84964.web.app/eliminar-conta`
- **Termos de Utilização**: `https://campus-erp-84964.web.app/termos`
- **Contacto do Responsável**: `pos25559@gmail.com` (*Pedro Silva — Projeto Unipedia, Portugal*)

> **Nota de Deploy**: Após `npm run check`, publicar `dist/` e as regras no Firebase (`npx firebase-tools deploy --only firestore:rules,hosting --project campus-erp-84964`) para garantir que `/privacidade`, `/termos` e `/eliminar-conta` respondem com HTTP 200 e as regras de validação coincidem com os campos da app.

## 4. Classificação Etária, Permissões Sensíveis & IA Generativa (EU AI Act Art. 50)
- **Idade mínima em Portugal**: 13 anos confirmados explicitamente no Passo 1 do Onboarding (Lei n.º 58/2019, Art. 16.º). Garantir na Play Console que o público-alvo é compatível com **13+** (não marcar como "app infantil" salvo fluxo parental verificável).
- **Declaração de Permissões Android**:
  - `POST_NOTIFICATIONS`: lembretes locais opcionais configuráveis pelo estudante (aulas, testes próximos, revisões SRS e proteção de sequência).
  - `ACCESS_NOTIFICATION_POLICY`: estritamente opcional e iniciada pelo utilizador nas definições do Escudo Anti-distração durante um bloco do `FocusTimer` (redireciona para as definições do sistema apenas quando ativado explicitamente).
- **Transparência IA**: Toda a resposta do Tutor Uni (`gemini-3.8-flash` com fallback `gemini-3.5-flash-lite` / `gemini-3.1-flash-lite`) e a geração de cartões de prática incluem transparência sobre fontes/IA, exigem consentimento explícito (`aiConsent`) e correm via **Firebase AI Logic** com **App Check** e quota diária ou chave pessoal opcional em *Avançado*, sem nenhuma chave Gemini hardcoded no binário APK/AAB.

## 5. Materiais Visuais da Ficha da Loja
Pasta de recursos em `docs/play-store-assets/`:
- Ícone adaptativo Android (`android/app/src/main/res/mipmap-*` e `public/icons/icon-512.png`)
- Banner gráfico de destaque (1024×500): `docs/play-store-assets/canva-feature-banner.png` (confirmar exportação à resolução exata antes da submissão)
- Capturas de ecrã móveis: capturar no dispositivo/emulador Android (`Hoje`, `FocusTimer + Prática Real`, `Cadeiras`, `Plano Semanal` e `Progresso · Retenção & Foco`) nos temas claro e escuro.
