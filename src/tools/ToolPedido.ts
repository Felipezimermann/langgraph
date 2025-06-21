import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import z from "zod";

class ToolPedido {
  public get getPedido() {
    return tool(
      async ({ numero }: { numero: string }) => {
        console.log("Tool de busca pedido:", numero);
        if (!numero) return "Informe o número do pedido.";
        return `Pedido ${numero} encontrado!`;
      },
      {
        name: "buscar_pedido",
        description: "Busca pedido por número, obrigatório informar o número.",
        schema: z.object({ numero: z.string() }),
      }
    );
  }

  public get node() {
    return new ToolNode([this.getPedido]);
  }
}

export default ToolPedido;
