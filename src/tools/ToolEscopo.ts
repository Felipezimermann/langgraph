import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import z from "zod";

class ToolEscopo {
  public get getEscopo() {
    return tool(
      async ({ escopo }: { escopo: "pedido" | "cliente" }) => {
        return escopo;
      },
      {
        name: "identifica_escopo",
        description: "Detecta se o escopo é sobre cliente ou pedido, qual quer coisa diferente disso não é suportado.",
        schema: z.object({
          escopo: z.enum(["pedido", "cliente"]),
        }),
      }
    );
  }

  public get node() {
    return new ToolNode([this.getEscopo]);
  }
}

export default ToolEscopo;
