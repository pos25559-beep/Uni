# Unipedia: a visão

**Data:** 16 de novembro de 2026 · Escrito depois da [auditoria de novembro](revisao/2026-11-auditoria.md). É uma opinião, não um contrato: serve para decidir o que entra e, sobretudo, o que fica de fora.

## A promessa

> **Abres a app e sabes o que estudar agora. Fechas o bloco e sabes o que ficou. Chegas ao teste sem surpresas.**

Tudo o que a Unipedia tem deve servir uma destas três frases. O que não serve nenhuma é decoração e sai do caminho principal.

A Unipedia completa não é uma agenda bonita nem um chat com mascote. É um **treinador de estudo que conhece o teu semestre**: as tuas cadeiras, os teus testes, os teus PDFs e os teus erros. A diferença face a um calendário é que decide por ti; a diferença face ao Gemini ou ao ChatGPT é que sabe o que sai no teste de dia 20 e o que falhaste ontem.

## Cinco princípios

1. **Uma decisão por ecrã.** O estudante cansado às 22h não escolhe entre doze cartões. Cada ecrã tem uma ação principal óbvia; o resto está a um toque, não à vista.
2. **A app trabalha, o estudante estuda.** Inserir dados é o custo; cada campo pedido tem de devolver valor no mesmo dia. Tudo o que se pode ler de uma foto, de um PDF ou de um calendário não se pede à mão.
3. **Sem castigo.** Falhar um dia é o caso normal. A app redistribui em silêncio e diz o que mudou. Não há contadores de atraso a vermelho nem sequências que se perdem por uma gripe.
4. **Honestidade antes de conforto.** Se a matéria não cabe até ao teste, a app diz, e propõe o que cortar. Uma retenção estimada mostra-se como estimativa. O Tutor diz «isto não está nos teus materiais».
5. **Os dados são do estudante.** Funciona sem conta e sem rede. O que sai do telemóvel é o mínimo, e o estudante sabe o quê e para onde.

## Uma semana com a Unipedia completa

**Domingo à noite, primeira vez.** A Marta, 2.º ano de Engenharia Mecânica, instala a app. Escolhe a faculdade e o curso; as cinco cadeiras aparecem sozinhas. Tira uma foto ao horário (isto já funciona hoje) e em 90 segundos tem cadeiras e aulas marcadas. Ainda não há datas de testes; a app arranca com estudo equilibrado e não insiste.

**Três semanas depois.** Os docentes publicam o calendário de avaliações. A app pergunta «Já tens as datas dos testes?»; a Marta tira uma foto e confirma cinco testes numa folha. O plano refaz-se e mostra uma frase: «Cabe tudo com 2 h por dia, mas a semana de 7 de dezembro tem três testes: comecei Cálculo uma semana mais cedo.» Ela carrega em «Parece-me bem».

**Segunda, 18:10.** Sai da última aula. O ecrã de bloqueio diz «Cálculo III · Campos vetoriais · 50 min». Abre, vê uma coisa: o bloco, com o porquê por baixo («o teste vale 40 % e é daqui a 6 dias»). Carrega em «Começar». O telemóvel entra em Não Incomodar.

**18:58.** O bloco acaba. Três perguntas, tiradas dos slides do professor que ela carregou. Responde por escrito a duas e falha a terceira. A app mostra a resposta com «p. 14 dos slides da aula 6» e diz: «Volto a perguntar-te isto na quinta.»

**Terça.** Tem jantar de curso, não estuda. Não acontece nada.

**Quarta de manhã.** Abre a app. Uma linha: «Ontem ficaram 100 min por fazer. Pus 50 hoje e 50 no sábado; o teste de Cálculo continua coberto. Desfazer.»

**Quinta, no autocarro.** Tem 12 minutos. A app sabe que não dá para um bloco e oferece as revisões devidas: seis cartões, incluindo o que falhou na segunda.

**Sexta à noite.** Encrava num exercício de Mecânica Aplicada. Abre o Tutor na cadeira, tira foto ao enunciado. O Uni pergunta o que ela já tentou, aponta onde o diagrama de corpo livre está incompleto e só mostra a resolução quando ela pede, com as unidades verificadas no fim. No fim: «Queres que guarde "momento de uma força" como ponto fraco? Ponho 25 min na terça.»

**Véspera do teste.** O ecrã do teste mostra: 7 de 8 tópicos vistos, 2 frágeis, e um botão «Simular 20 minutos» com perguntas dos tópicos frágeis. Não mostra gráficos.

**Depois do teste.** A Marta regista a nota. A app compara com a prontidão que estimava e afina o modelo para a próxima vez.

Nada desta semana exige uma funcionalidade exótica. Exige que as peças que já existem liguem umas às outras sem a Marta fazer de cola.

## O produto completo

### Os cinco sítios

| Sítio | Responde a | O que mostra |
|---|---|---|
| **Hoje** | O que faço agora? | Um bloco (ou as revisões devidas, ou «dia livre»), o que mudou no plano, e o próximo teste. Nada mais acima da dobra. |
| **Plano** | Como chego aos testes? | A semana em blocos, cada um com o seu porquê, e uma faixa por teste com «necessário / marcado / feito». |
| **Cadeiras** | Onde está tudo desta cadeira? | Testes e pesos, tópicos com estado, materiais, e o Uni dessa cadeira. |
| **Tutor** | Não percebo isto. | Conversa que cita os materiais com página e devolve cartões e pontos fracos ao plano. |
| **Testes** (em vez de «Progresso») | Estou pronta? | Um cartão por teste próximo: cobertura, tópicos frágeis, simulação. Os gráficos ficam atrás de «Ver detalhe». |

### O que eu acrescentava

1. **Os testes a chegarem ao plano quando passam a existir.** A leitura do horário por foto já está feita: no onboarding, uma imagem identifica as cadeiras e as aulas, e o mesmo leitor já sabe ler avaliações. As datas dos testes ficam para depois de propósito, porque no início do semestre ainda não existem. O que falta é o regresso: a app lembrar-se de as pedir na altura certa (2 a 3 semanas depois do arranque, ou quando o estudante escreve «teste» numa nota ou no Diário), e «Adicionar provas» abrir diretamente a foto do calendário de avaliações ou uma linha manual por teste. A importação do CLIP por HTML sai.
2. **Plano com contas à vista.** Por teste: minutos necessários (a partir dos tópicos e da confiança), minutos marcados, e o que fica de fora se não couber. É isto que faz o estudante confiar.
3. **Replaneamento automático** ao abrir a app, limitado pelas datas dos testes e pela meta diária, sempre com «Desfazer».
4. **Recall que funciona sem IA.** Resposta escrita, três perguntas-guia por tipo de tópico (definir, aplicar, relacionar), e cartão criado a partir da própria resposta. A IA melhora as perguntas; não é condição para haver recall.
5. **Caderno local.** Os PDFs são lidos e indexados no telemóvel; o Tutor recebe só os excertos certos e responde com «p. X». Pesquisa nos materiais a funcionar sem rede.
6. **Modo «tenho N minutos».** Um toque no Hoje: 10, 25 ou 50 minutos. A app escolhe entre revisões devidas e o próximo bloco encurtado.
7. **Simulação de teste.** 20 a 40 minutos de perguntas dos tópicos que saem, com peso para os frágeis, e um resumo honesto no fim.
8. **Fecho do ciclo com a nota real.** Registar a nota depois do teste calibra a estimativa de prontidão. Sem isto, a «retenção» é um número sem prova.
9. **Baralhos partilhados por cadeira.** Colegas da mesma cadeira e ano trocam cartões por código ou ligação (o ficheiro de partilha de semestre já aponta para aqui). É o único efeito de rede que faz sentido: quem entra encontra a cadeira já com material.
10. **Widget e notificação com o próximo bloco** no Android. O melhor ecrã da app é o que não obriga a abri-la.

### O que eu tirava do caminho principal

- Correio académico, coleção de Unis e acessórios, voz ao vivo: para «Experimental», desligados por omissão.
- OneDrive e importação do CLIP por HTML: removidos.
- Sete paletas, dois estilos e cinco vozes no onboarding: para Definições. O onboarding fica com curso, cadeiras, testes e ritmo.
- Contadores de atraso, sequências que se perdem e qualquer métrica que não mude uma decisão.

O Uni fica, e ganha: **um** Uni por cadeira, que evolui com o domínio real da matéria. É a alma da marca. A coleção à volta dele é que dispersa.

## Como implementava

### 1. Um motor de plano que se explica

O planeador passa a ser uma função pura em três passos, cada um testável sozinho:

1. **Necessidade:** por teste, minutos por tópico a partir do estado, da confiança e do peso.
2. **Capacidade:** por dia, as janelas livres reais (aulas, eventos, atividades), da manhã à noite.
3. **Afetação:** distribuir por urgência e cobertura, projetar as revisões 1→3→7, e devolver o que não coube.

Cada bloco sai com `reason { code, params }` e cada plano com um relatório de viabilidade por teste. O texto do «porquê» é traduzido no ecrã; nos dados ficam só códigos. O replaneamento é a mesma função, corrida com o que já foi feito. Os casos difíceis (três testes numa semana, 30 minutos por dia, aulas à noite, teste amanhã) vivem como testes unitários.

### 2. Dados que não se perdem

- Estado pequeno e frequente em `localStorage`; tudo o que cresce (conversas, materiais, índices, cartões) em IndexedDB.
- Migrações com testes de dados reais das versões antigas.
- Sincronização por documento com fila e nova tentativa; o estudante vê «guardado» ou «por sincronizar», nunca nada.
- Cópia de segurança exportável num ficheiro, sempre.

### 3. IA em camadas, da mais barata para a mais cara

| Camada | Onde corre | Para quê |
|---|---|---|
| 0. Regras e pesquisa local | Telemóvel | Plano, revisões, pesquisa nos PDFs, recall sem IA |
| 1. Excertos + modelo rápido | Gemini (Flash-Lite) | Perguntas de recall, cartões, leitura de fotos |
| 2. Excertos + modelo principal | Gemini | Tutor em exercícios, simulações |

O princípio: **nenhuma função essencial depende da camada 1 ou 2.** Se a quota acabar, a app continua a planear, cronometrar e rever.

O Tutor recebe sempre o mesmo pacote curto: regras da cadeira, testes próximos, tópicos frágeis, erros recentes de recall e 4 a 8 excertos com página. Os documentos entram delimitados e marcados como dados, não como instruções. As ferramentas (criar cartão, marcar ponto fraco, criar sessão) passam por chamada de funções a sério, e as que escrevem pedem confirmação.

A pedagogia fica escrita como método, não como tom: perguntar o que já foi tentado; pistas antes da resolução, com saída depois da terceira; em exercícios de engenharia, dados → incógnita → esquema → resolução simbólica → números → unidades → ordem de grandeza; LaTeX consistente; «não está nos teus materiais» quando não está.

### 4. Uma interface que se verifica sozinha

- Tokens para tudo (cores claras e escuras, quatro raios, uma escala de espaços). O `ui-guard` recusa cores escritas à mão, alvos abaixo de 44 px e comparações com texto traduzido.
- Um componente de diálogo e uma folha inferior, usados em todo o lado, com foco preso e devolvido.
- `a11y:smoke` dentro do `check`, em claro e escuro, com modais, onboarding e modo foco.
- Capturas a 390 px comparadas em cada PR para os dez ecrãs principais.

### 5. Custo e conformidade

| Tema | Plano gratuito (Spark) | Só com plano pago |
|---|---|---|
| Plano, foco, recall, caderno local | Sim, tudo no dispositivo | — |
| Sincronização e baralhos partilhados | Sim, em pequena escala | Escala de milhares de utilizadores |
| Tutor partilhado na UE | **Não cumpre os termos do Gemini** (ADR-001) | Blaze com limite de gastos |
| Quotas de IA impostas no servidor | Não (só contagem) | Cloud Functions |
| Chave pessoal do estudante | Sim | — |

A conclusão prática: **a Unipedia pode ser excelente sem IA partilhada**, e deve ser desenhada assim. O Tutor é o que a torna especial, mas abri-lo ao público exige o passo pago. O caderno local reduz esse custo antes de ele existir.

## Como servir a missão

A marca existe para ajudar alunos. Isso mede-se, e a app deve ser desenhada para o provar a si própria.

1. **Medir o que importa, sem vigiar.** Três números, contados no dispositivo e partilhados só com consentimento e sem conteúdo: blocos planeados que foram feitos, revisões devidas que foram feitas, e a diferença entre prontidão estimada e nota real. Se a app não mexe nestes números, o resto é cosmética.
2. **Piloto pequeno e ouvido.** Cinco a sete colegas durante duas semanas, com uma conversa de 15 minutos no fim de cada semana. Duas perguntas chegam: «quando abriste e fechaste logo?» e «o que fizeste fora da app que devia estar cá dentro?».
3. **O essencial gratuito para sempre.** Planear, focar e rever não custam nada a servir (correm no telemóvel) e não devem ser pagos. Se um dia houver receita, vem do que tem custo real: IA partilhada com mais uso. Nunca de anúncios nem de dados.
4. **Acessível a quem mais precisa.** WCAG AA a sério, funciona num Android de gama baixa e sem rede, e não exige conta. Um estudante com dislexia, com défice de atenção ou a trabalhar à noite é exatamente quem mais ganha com um plano que decide por ele.
5. **Cuidar de quem está em stress.** Época de exames é ansiedade. A linguagem é calma, sem urgência fabricada. Quando o estudante diz que está mal, o Uni reduz a carga e, se for sério, aponta para os serviços de apoio da faculdade em vez de tentar fazer de psicólogo.
6. **Integridade académica.** O Tutor ajuda a perceber, não a entregar trabalho feito. Em trabalhos avaliados dá pistas e método. Isto protege o estudante e torna a app recomendável por docentes.
7. **Crescer por cadeira, não por anúncio.** Um estudante que partilha o baralho de Cálculo III com a turma traz dez. O crescimento natural é faculdade a faculdade, com planos curriculares e baralhos já prontos para quem chega.
8. **Dizer a verdade sobre a IA.** Para onde vão os dados, quem os pode ver, e o que muda com chave pessoal. Em linguagem de estudante, no momento em que ativa, não numa política que ninguém lê.

## Três horizontes

| Horizonte | Objetivo | Entra |
|---|---|---|
| **Agora** (até ao fim do piloto) | O ciclo anda sozinho e não engana | Porta de qualidade verde; proteções do ADR-001; folha de testes; planeador com janelas reais, cobertura e viabilidade; replaneamento; «porquê» nos blocos; recall sem IA; acessibilidade e i18n de base |
| **A seguir** (semestre de primavera) | O Uni é melhor do que um chat genérico | Caderno local com citação de página; pedagogia de engenharia; cartões e pontos fracos a partir da conversa; ecrã por teste e simulação; dados em IndexedDB com sincronização fiável; decisão Blaze |
| **Depois** | Crescer sem perder a calma | Baralhos partilhados por cadeira; nota real a calibrar a prontidão; widget Android; Play Store em produção; mais faculdades e planos curriculares; iOS se houver procura |

## O que a Unipedia não deve ser

- **Uma rede social.** Sem feed, sem rankings entre colegas.
- **Um jogo.** O Uni evolui com domínio real; não há moedas, lojas nem sequências punitivas.
- **Um substituto das aulas ou dos docentes.** Organiza e treina o que o estudante já tem.
- **Um produto de dados.** Nada de perfis vendidos, nada de anúncios.
- **Uma app que só funciona com IA.** A IA é o melhor da experiência, não o chão.

## Como saber que chegámos

- Um estudante novo tem o semestre e um plano em **menos de 2 minutos**, sem escrever o nome de uma cadeira; e quando as datas saem, os testes entram em **menos de 1 minuto**.
- **Mais de 60 %** dos blocos planeados são feitos ou conscientemente adiados.
- **Mais de 70 %** das revisões devidas são feitas na semana em que vencem.
- A prontidão estimada fica a **menos de 2 valores** da nota real, em média.
- O Tutor cita página em **mais de 80 %** das respostas sobre matéria com materiais carregados.
- Nenhum estudante do piloto diz «não sabia onde carregar».

Quando estes seis forem verdade, a promessa do início está cumprida.
