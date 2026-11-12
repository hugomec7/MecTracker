# Mec Tracker MCP

Deixa o **Claude Desktop** ou o **Claude Code** usar o painel Mec Tracker no Premiere Pro por comandos curtos, sem tirar print nem clicar na tela. [Read in English](README.md).

```
Claude  ── MCP (stdio) ──  server.js  ── WebSocket 127.0.0.1:47321 ──  painel Mec Tracker (3.4.0+)
```

Painéis UXP não podem abrir uma porta, então é o painel que se conecta a este servidor. O servidor não tem dependências (Node 18+).

## Instalar

**O mais fácil**: no Claude Code (ou na aba Code do Claude Desktop) cole `Instale o Mec Tracker para mim: https://github.com/hugomec7/MecTracker`. O Claude segue os passos do README principal e instala este conector e o plugin do Premiere.

**Plugin do Claude Code** (esta pasta é um plugin do Claude Code; a raiz do repositório é o marketplace dele):

```text
/plugin install mectracker --marketplace hugomec7/MecTracker
```

**Plugin do Premiere pela linha de comando** (baixa a release mais nova e roda o instalador):

```bash
npx -y https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz --install-premiere-plugin
```

O Claude também tem isso como a ferramenta `mectracker_install_plugin`.

### Outros jeitos

**Copie e cole no Claude** (Claude Code, ou a aba Code do Claude Desktop). Ele instala sozinho. Precisa do [Node.js](https://nodejs.org) 18+:

```text
Instale o conector MCP do Mec Tracker (plugin do Premiere Pro) neste computador:
1. Confira se o Node.js 18 ou mais novo está instalado (node -v). Se não estiver, me peça para instalar pelo nodejs.org e pare aqui.
2. Claude Code: rode  claude mcp add mectracker -s user -- npx -y https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz
   (no Windows use "cmd /c npx" no lugar de "npx").
3. Claude Desktop: no arquivo claude_desktop_config.json (Mac: ~/Library/Application Support/Claude/, Windows: %APPDATA%\Claude\), crie se não existir e acrescente em "mcpServers" a entrada "mectracker" com "command": "npx" e "args": ["-y", "https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz"] (no Windows: "command": "cmd", "args": ["/c", "npx", "-y", "https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz"]). Não apague o que já existe no arquivo.
4. No fim, me diga para reiniciar o Claude e, no Premiere, marcar Mec Tracker > Ajuda > Permitir controle pelo Claude.
Instruções: https://github.com/hugomec7/MecTracker/tree/main/mcp
```

**Claude Desktop, sem precisar de Node**: dê dois cliques no [`../dist/MecTracker.mcpb`](../dist/MecTracker.mcpb) (ele também vem na pasta `Claude` do zip da release), ou arraste para **Configurações > Extensões**.

**Claude Code**:

```bash
claude mcp add mectracker -s user -- npx -y https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz
```

**Claude Desktop à mão** (Configurações > Desenvolvedor > Editar configuração):

```json
{
  "mcpServers": {
    "mectracker": { "command": "npx", "args": ["-y", "https://raw.githubusercontent.com/hugomec7/MecTracker/main/dist/mectracker-mcp.tgz"] }
  }
}
```

No Windows use `"command": "cmd", "args": ["/c", "npx", "-y", "..."]`.

Depois, no Premiere: **Mec Tracker > Ajuda > Permitir controle pelo Claude**. O painel tenta de novo a cada poucos segundos, então a ordem não importa. Uma bolinha verde **Claude** aparece no topo do painel quando ele está conectado.



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
| `mectracker_install_plugin` | Instala ou atualiza o plugin no Premiere (release mais nova do GitHub). |

`track` e `paste` esperam até `wait_seconds` (padrão 45). Tarefas mais longas devolvem o progresso; o Claude chama `mectracker_wait` para continuar esperando. Com os ids, o Claude escolhe os clipes sem mexer na sua seleção da timeline.

A máscara continua sendo feita e rastreada no Premiere (Effect Controls); o Mec Tracker lê ela de lá.

## Configuração e segurança

- Porta `47321`, só em `127.0.0.1`. Dá para mudar com a variável `MECTRACKER_PORT` (o painel usa 47321, então só para testes).
- Conexões vindas de páginas da web (Origin `http(s)`) são recusadas, então um site não consegue controlar o painel.
- Só uma janela do Claude fica com a porta. Uma segunda espera e assume quando a primeira fechar.
- O painel só se conecta com **Permitir controle pelo Claude** marcado (vem desligado).
