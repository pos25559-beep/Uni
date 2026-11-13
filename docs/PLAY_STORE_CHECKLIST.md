# Checklist Google Play Store & Conformidade UE — Unipedia

Este documento reúne os requisitos técnicos e legais obrigatórios para publicar **Unipedia** (`com.unipedia.app`) na Google Play Store (União Europeia / Portugal).

## 1. Requisitos Técnicos Android (API 36)
- [x] `compileSdkVersion = 36` e `targetSdkVersion = 36` (`android/variables.gradle`)
- [x] `minSdkVersion = 24` (suporte amplo mantendo segurança moderna)
- [x] `minifyEnabled true` e `shrinkResources true` configurados em `release` (`android/app/build.gradle`)
- [x] Edge-to-Edge com respeitar `env(safe-area-inset-*)`, barra de estado sincronizada (`@capacitor/status-bar`), teclado virtual (`@capacitor/keyboard` + `adjustResize`) e `@capacitor/splash-screen`
- [x] Regras de backup RGPD (`android:dataExtractionRules` + `android:fullBackupContent`) impedindo cópia não consentida de `app_webview/` e tokens locais
- [ ] **Assinatura Release**: gerar ou configurar `keystore` de upload fora do repositório (`android/app/keystore.properties` ignorado no `.gitignore`) e construir AAB via `./gradlew bundleRelease`

## 2. Formulário de Segurança de Dados (Play Console -> Data Safety)
A declarar no Google Play Console:
- **A app recolhe ou partilha dados de utilizadores?**
  - Sim, *se* o utilizador ativar voluntariamente a sincronização Firebase ou o Tutor IA.
  - Em modo 100% local, nenhum dado sai do dispositivo.
- **Tipos de dados tratados quando sincronizado na Cloud (opcional):**
  - *Informações pessoais*: Nome, e-mail (para autenticação Firebase Auth).
  - *Conteúdo da aplicação*: Cadeiras, notas académicas, eventos de calendário, tarefas e mensagens de estudo (armazenados exclusivamente em `/users/{uid}` sob Firestore Security Rules).
- **Encriptação em trânsito?** Sim (HTTPS / TLS).
- **Pedido de eliminação de conta:**
  - In-app: **Definições → Dados e privacidade → Apagar conta e dados** (`/eliminar-conta`).
  - URL público exigido pelo Play Console: `https://campus-erp-84964.web.app/eliminar-conta`
- **Publicidade / SDKs de rastreio?** Não existem SDKs de anúncios, Analytics comportamental ou Ad ID.

## 3. Links Públicos Obrigatórios (Play Store Listing)
- **Política de Privacidade (RGPD)**: `https://campus-erp-84964.web.app/privacidade`
- **Eliminação de Conta & Dados**: `https://campus-erp-84964.web.app/eliminar-conta`
- **Termos de Utilização**: `https://campus-erp-84964.web.app/termos`
- **Contacto do Responsável**: `pos25559@gmail.com` (*Pedro Silva — Projeto Unipedia, Portugal*)

> **Nota de Deploy**: Após `npm run build`, publicar `dist/` no Firebase Hosting (`firebase deploy --only hosting,firestore:rules`) para garantir que `/privacidade`, `/termos` e `/eliminar-conta` estão acessíveis online com HTTP 200.

## 4. Classificação Etária & IA Generativa (EU AI Act Art. 50)
- **Idade mínima em Portugal**: 13 anos confirmados explicitamente no Passo 1 do Onboarding (Lei n.º 58/2019, Art. 16.º). Caso o público-alvo da ficha seja **Todo o Público / 13+**, garantir que a ficha Play Console indica *Público: maiores de 13 anos* (não marcar como "app infantil" a menos que haja fluxo parental verificável).
- **Transparência IA**: Toda a resposta da Gemini API inclui a indicação *"Gerado por IA"*, requer consentimento explícito (`aiConsent`) e chave pessoal (BYOK). Sem nenhuma chave hardcoded no binário APK/AAB.

## 5. Materiais Visuais da Ficha da Loja
Pasta de rascunhos/exports preparada em `docs/play-store-assets/`:
- Ícone adaptativo Android (`android/app/src/main/res/mipmap-*` e `public/icons/icon-512.png`)
- Banner gráfico de destaque (1024×500): `docs/play-store-assets/canva-feature-banner.png` (reexportar a alta resolução do Canva antes de submeter)
- Capturas de ecrã móveis: capturar do emulador Pixel (`Hoje` bento, `Onboarding`, `Cadeiras`, `Plano Semanal`) em tema claro e escuro.
