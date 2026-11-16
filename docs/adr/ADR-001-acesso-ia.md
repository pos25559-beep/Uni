# ADR-001: Como a Unipedia acede ao Gemini (piloto e depois)

**Estado:** Proposto
**Data:** 16 de novembro de 2026
**Decide:** Pedro de Oliveira Silva (responsável pelo tratamento e pelo projeto Firebase)

## Contexto

O Uni (tutor, caderno, recall, leitura de prints) chama o Gemini pelo Firebase AI Logic com o backend Gemini Developer API. O projeto `campus-erp-84964` está no plano Spark, sem faturação. Há dois modos:

- **Uni partilhado:** usa a quota gratuita do projeto. Os limites diários (15 mensagens, 3 cadernos, 8 recalls) são contados no `localStorage`, por isso qualquer pessoa os contorna limpando os dados do navegador. A única proteção do lado do servidor é o App Check com reCAPTCHA Enterprise.
- **Chave pessoal:** o estudante cola a sua chave da Google, que fica só no dispositivo. Os limites locais são ignorados.

Forças em jogo:

1. **Termos do Gemini (em vigor desde 23 de março de 2026):**
   - Só serviços pagos podem servir utilizadores no Espaço Económico Europeu, na Suíça e no Reino Unido.
   - É proibido usar a API em apps dirigidas a menores de 18 anos ou com provável acesso por eles.
   - No nível gratuito, a Google usa o conteúdo para melhorar os seus produtos e pode haver revisão humana.

   **O Uni partilhado, como está, não cumpre os termos para estudantes portugueses.**
2. **Custo:** o Pedro quer manter tudo gratuito. Ao ligar uma conta de faturação, *toda* a utilização do Gemini nesse projeto passa a ser paga: deixa de haver quota grátis.
3. **Quota partilhada:** com 50 a 100 utilizadores ativos, a quota gratuita pode esgotar-se a meio do dia e o Uni deixa de responder a toda a gente ao mesmo tempo.
4. **Consumo do caderno:** o orçamento de contexto por omissão é de 240 mil tokens. Com PDFs grandes, cada pedido de caderno pode custar 100 vezes mais do que uma mensagem normal.
5. **Piloto:** o Pedro aceitou correr o risco dos termos durante um piloto pequeno de 2 semanas, com 5 a 7 colegas maiores de idade.

## Decisão

Avançar em **duas fases**:

- **Fase 1 — piloto (agora, 2 semanas): opção A com salvaguardas.** Fica o Uni partilhado gratuito, mas:
  - Os colegas confirmam que têm 18 anos ou mais antes de ativar a IA.
  - O orçamento de contexto do caderno no modo partilhado desce para 60 mil tokens.
  - O piloto fica limitado a convites.
  - A política de privacidade já avisa que, no nível gratuito, a Google usa o conteúdo.
- **Fase 2 — depois do piloto, se os números forem bons: opção C.** O projeto passa ao plano Blaze com um limite de gastos de 10 a 20 € por mês. O Uni partilhado fica a cumprir os termos e a chave pessoal continua disponível para quem quiser mais uso.
- **Em paralelo e independente das fases: opção D (caderno local).** Os PDFs são indexados no dispositivo e só os excertos relevantes vão para o Gemini. Isto corta os tokens por pedido e tem valor em qualquer cenário.

## Opções consideradas

### Opção A: manter o Uni partilhado no plano Spark (estado atual)

| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa: já está feito |
| Custo | 0 € |
| Escalabilidade | Fraca: uma quota partilhada por todos, limites contornáveis |
| Conformidade | **Não cumpre** os termos do Gemini na UE nem a regra dos 18 anos |

**Prós:** custo zero, sem fricção para o estudante, ideal para validar se o ciclo plano → foco → recall funciona.
**Contras:** viola os termos (a Google pode suspender a chave ou o projeto); a Google usa os dados enviados; tudo pára quando a quota esgota.

### Opção B: só chave pessoal (desligar o Uni partilhado)

| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa: retirar o modo partilhado e reforçar o onboarding da chave |
| Custo | 0 € para a Unipedia |
| Escalabilidade | Boa: cada estudante tem a sua quota |
| Conformidade | O estudante passa a ser o "programador" perante a Google. Continua a ter de ter 18+ e, no nível gratuito, os dados também são usados pela Google |

**Prós:** a Unipedia deixa de responder pelo uso do Gemini; não há quota partilhada a esgotar.
**Contras:** o atrito é grande (criar um projeto na Google e copiar uma chave), e no piloto muitos colegas não vão passar deste passo; a conformidade fica empurrada para o estudante, não resolvida; os termos falam em uso profissional ou empresarial, por isso um estudante que usa a sua chave para estudar também fica numa zona cinzenta.

### Opção C: plano Blaze com limite de gastos

| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa no código; média na operação (alertas, limite de gastos, acompanhamento) |
| Custo | Uso real de um Flash a 0,75 $ por milhão de tokens de entrada e 3,75 $ por milhão de saída (preço introdutório até 31/12/2026; pode duplicar depois) |
| Escalabilidade | Boa: limites pagos muito mais altos |
| Conformidade | **Cumpre** a regra de serviços pagos na UE; num projeto pago a Google não usa o conteúdo para treinar modelos |

Estimativa com os limites atuais (pior caso por utilizador e por dia):

| Tipo de pedido | Pedidos/dia | Tokens de entrada | Custo/dia |
|---|---|---|---|
| Mensagem | 15 | ~6 mil cada | ~0,11 $ |
| Caderno (contexto de 240 mil) | 3 | 240 mil cada | ~0,55 $ |
| Caderno (contexto de 60 mil) | 3 | 60 mil cada | ~0,14 $ |
| Recall | 8 | ~3 mil cada | ~0,03 $ |

Para 7 colegas durante 14 dias, o pior caso dá 27 $ com o contexto de 60 mil e 67 $ com o de 240 mil. Com uso normal, o valor real deve ficar abaixo de 10–15 $.

**Prós:** resolve os termos e a privacidade; acaba a quota partilhada a esgotar; não pede código novo.
**Contras:** deixa de ser gratuito; o limite de gastos não é absoluto (o corte chega com atraso); como os limites de uso são do lado do cliente, alguém que abuse da app pode gastar até ao limite. É preciso ativar também os limites por utilizador do App Check e do AI Logic (configuração a confirmar na consola).

### Opção D: caderno local (pdfjs-dist + MiniSearch no dispositivo)

| Dimensão | Avaliação |
|---|---|
| Complexidade | Média: extração de texto, divisão em blocos, índice no IndexedDB, citações de página |
| Custo | 0 € e reduz o custo das opções A e C |
| Escalabilidade | Excelente: corre no telemóvel do estudante |
| Conformidade | Melhor do que a alternativa: em vez dos PDFs inteiros, vão para a Google só os excertos usados |

**Prós:** 5 a 20 vezes menos tokens por pedido de caderno; respostas com a página citada; funciona offline para pesquisa; é a diferença mais forte face ao Gemini ou ao ChatGPT genéricos.
**Contras:** PDFs digitalizados (sem texto) e fórmulas em imagem continuam a precisar do Gemini; ocupa espaço no dispositivo; mais código para manter.

## Análise dos compromissos

- **A contra C** é uma troca entre custo zero e cumprir as regras. Para 2 semanas com colegas adultos que conheces, o risco da A é limitado e foi aceite conscientemente. Para abrir a app a desconhecidos, a A não serve: uma suspensão do projeto pela Google deita abaixo a app toda (login, sincronização e IA), não só o Uni.
- **A B não é o meio-termo que parece.** Passa a fricção para o estudante e não resolve a questão dos 18 anos nem a do uso dos dados no nível gratuito. Fica como opção avançada para quem já tem chave.
- **A D não compete com as outras: torna-as mais baratas.** Fazê-la já reduz o custo da fase 2 antes de este existir.
- **O maior buraco técnico é a quota estar do lado do cliente.** Na opção A isso só esgota a quota; na opção C esgota dinheiro. Antes de passar ao Blaze, os limites por utilizador têm de existir do lado do Google (App Check obrigatório + limites por utilizador no AI Logic).

## Consequências

- **Fica mais fácil:** fazer o piloto já, sem custo; medir quantas mensagens e cadernos cada estudante usa por dia (o que dá o número real para orçar a fase 2); justificar o Blaze com dados em vez de palpites.
- **Fica mais difícil:** durante o piloto, a app não cumpre os termos da Google e não pode ser divulgada publicamente nem ir para a Play Store em produção.
- **A rever:**
  - No fim do piloto (dia 14): decidir entre a fase 2 ou desligar o Uni partilhado na UE.
  - A 1 de janeiro de 2027: o preço introdutório do Flash acaba e convém recalcular os custos.
  - Se a Google mudar os termos do nível gratuito.

## Ações

1. [ ] **Piloto:** confirmação "Tenho 18 anos ou mais" antes de ativar o Tutor ou o Uni partilhado. A resposta fica guardada nas definições.
2. [ ] **Piloto:** baixar o orçamento de contexto do caderno no modo partilhado para 60 mil tokens (com chave pessoal mantém-se 240 mil).
3. [ ] **Piloto:** registar o uso diário de IA por utilizador (contagem, sem conteúdo) para estimar o custo real da fase 2.
4. [ ] **Piloto:** na consola do Firebase, confirmar que o App Check está em modo *enforce* no AI Logic e ver se há limite de pedidos por utilizador.
5. [ ] **Caderno local:** indexação de PDFs com `pdfjs-dist` + MiniSearch e envio só dos excertos, num branch próprio.
6. [ ] **Fim do piloto:** decidir a fase 2. Se avançar: Blaze, limite de gastos de 10–20 €/mês, alertas a 50/90/100 %, política de privacidade atualizada (o nível pago não usa os dados para treino).
