import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import z from "zod";

class ToolEscopo {
  public get getEscopo() {
    return tool(
      async ({ escopo }: { escopo: "agent_pedido" | "agent_cliente" }) => {
        return escopo;
      },
      {
        name: "identifica_escopo",
        description: `
        Detecta se o escopo é sobre cliente ou pedido, e definal qual o 
        agente que ele vai usar qual quer coisa diferente disso não é suportado retone que não pode responder essa pergunta.
        `,
        schema: z.object({
          escopo: z.enum(["agent_pedido", "agent_cliente"]),
        }),
      }
    );
  }

  public get node() {
    return new ToolNode([this.getEscopo]);
  }
}

export default ToolEscopo;
