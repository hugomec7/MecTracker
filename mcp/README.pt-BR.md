# Mec Tracker MCP

Deixa o **Claude Desktop** ou o **Claude Code** usar o painel Mec Tracker no Premiere Pro por comandos curtos, sem tirar print nem clicar na tela. [Read in English](README.md).

```
Claude  ── MCP (stdio) ──  server.js  ── WebSocket 127.0.0.1:47321 ──  painel Mec Tracker (3.4.0+)
```

Painéis UXP não podem abrir uma porta, então é o painel que se conecta a este servidor. O servidor não tem dependências (Node 18+).

## Instalar

**Claude Desktop**: dê dois cliques no [`../dist/MecTracker.mcpb`](../dist/MecTracker.mcpb) (ele também vem na pasta `Claude` do zip da release), ou arraste para **Configurações > Extensões**.

**Claude Code**:

```bash
claude mcp add mectracker -- node "/caminho/para/server.js"
```

Depois, no Premiere: **Mec Tracker > Ajuda > Permitir controle pelo Claude**. O painel tenta de novo a cada poucos segundos, então a ordem não importa. Uma bolinha verde **Claude** aparece no topo do painel quando ele está conectado.

## Comandos

| Ferramenta | O que faz |
|---|---|
| `mectracker_status` | Conexão, sequência, agulha, clipes selecionados, opções, rastreios guardados, tarefa atual. |
| `mectracker_list_clips` | Todos os clipes de vídeo da sequência ativa: `id` (ex.: `V2-508032000000`), trilha, nome, início/fim (s), se está selecionado. |
| `mectracker_set_options` | `action` (`follow`/`stabilize`), `position`, `rotation`, `scale`, `every_frames`, `paste_to_clip_above`. |
| `mectracker_track` | Rastreia os `clips` indicados (ou a seleção). Com `paste_to_clip_above` também cola nos clipes da trilha de cima. |
| `mectracker_paste` | Cola o(s) rastreio(s) guardado(s) nos `clips` (ou na seleção). `reference_seconds` = onde o alvo já está bem posicionado (padrão: agulha). |
| `mectracker_wait` | Espera a tarefa em andamento (rastrear/colar) e devolve o resultado. |
| `mectracker_cancel` | Cancela o rastreio em andamento. |
| `mectracker_discard_tracks` | Apaga os rastreios guardados. |
| `mectracker_log` | Últimas linhas do registro do painel. |

`track` e `paste` esperam até `wait_seconds` (padrão 45). Tarefas mais longas devolvem o progresso; o Claude chama `mectracker_wait` para continuar esperando. Com os ids, o Claude escolhe os clipes sem mexer na sua seleção da timeline.

A máscara continua sendo feita e rastreada no Premiere (Effect Controls); o Mec Tracker lê ela de lá.

## Configuração e segurança

- Porta `47321`, só em `127.0.0.1`. Dá para mudar com a variável `MECTRACKER_PORT` (o painel usa 47321, então só para testes).
- Conexões vindas de páginas da web (Origin `http(s)`) são recusadas, então um site não consegue controlar o painel.
- Só uma janela do Claude fica com a porta. Uma segunda espera e assume quando a primeira fechar.
- O painel só se conecta com **Permitir controle pelo Claude** marcado (vem desligado).
