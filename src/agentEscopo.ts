import "dotenv/config";
import { writeFileSync } from "node:fs";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { de } from "zod/dist/types/v4/locales";
import { ECDH } from "node:crypto";

//---------------------------------------------
// 1. Definição das Tools
//---------------------------------------------

const identificaEscopoTool = tool(
  async ({ escopo }: { escopo: "pedido" | "cliente" }) => {
    return escopo;
  },
  {
    name: "identifica_escopo",
    description: `Detecta se o escopo é sobre cliente ou pedido, qual quer coisa diferente retorno o escopo como "undefined".`,
    schema: z.object({
      escopo: z.enum(["pedido", "cliente"]),
    }),
  }
);

const buscarPedidoTool = tool(
  async ({ numero }: { numero: string }) => {
    console.log("Buscando pedido:", numero);
    if (!numero) return "Informe o número do pedido.";
    return `Pedido ${numero} encontrado!`;
  },
  {
    name: "buscar_pedido",
    description: "Busca pedido por número",
    schema: z.object({ numero: z.string() }),
  }
);

const buscarClienteTool = tool(
  async ({ cpf }: { cpf: string }) => {
    if (!cpf) return "Informe o CPF.";
    return `Cliente ${cpf} localizado!`;
  },
  {
    name: "buscar_cliente",
    description: "Busca cliente por CPF",
    schema: z.object({ cpf: z.string() }),
  }
);

(async () => {
  //---------------------------------------------
  // 2. Modelos (Agents)
  //---------------------------------------------

  const llmEscopo = new ChatOpenAI({ modelName: "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY, maxTokens: 1000, temperature: 0.9, verbose: false }).bindTools([identificaEscopoTool]);

  const agentFinal = new ChatOpenAI({ modelName: "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY, maxTokens: 1000, temperature: 0.9 }).bindTools([]);

  //---------------------------------------------
  // 3. Tools agrupadas por escopo
  //---------------------------------------------
  const escopoTools = new ToolNode([identificaEscopoTool]);
  const toolNodePedido = new ToolNode([buscarPedidoTool]);
  const toolNodeCliente = new ToolNode([buscarClienteTool]);

  //---------------------------------------------
  // 4. Grafo de Estado
  //---------------------------------------------

  // Define the function that calls the model

  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await llmEscopo.invoke(state.messages);

    // We return a list, because this will get added to the existing list
    return { messages: [response] };
  }
  const listaEscopo = ["pedido", "cliente"];
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("llm", callModel)
    .addNode("toolsEscopo", escopoTools)
    .addNode("toolsPedido", toolNodePedido)
    .addNode("toolsCliente", toolNodeCliente)
    .addNode("roteador", async (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const message = lastMessage?.content?.toString().toLowerCase();
      console.log("\nROTEADOR (NODE) -->", message);
      if (message.includes("pedido")) {
        // Retorna ToolMessage para acionar o ToolNode
        // Extraia o número do pedido do texto da mensagem (exemplo simples)
        const numeroPedido = message.match(/\d+/)?.[0] || "12345";
        return {
          messages: [
            new ToolMessage({
              name: "buscar_pedido",
              additional_kwargs: { numero: numeroPedido },
              content: "",
              tool_call_id: "buscar_pedido_" + numeroPedido,
            }),
          ],
        };
      }
      if (message.includes("cliente")) {
        // Extraia o CPF do texto da mensagem (exemplo simples)
        const cpfCliente = message.match(/\d{11}/)?.[0] || "00000000000";
        return {
          messages: [
            new ToolMessage({
              name: "buscar_cliente",
              additional_kwargs: { cpf: cpfCliente },
              content: "",
              tool_call_id: "buscar_cliente_" + cpfCliente,
            }),
          ],
        };
      }
    })
    .addNode("agentFinal", async (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const message = lastMessage?.content?.toString().toLowerCase();
      console.log("\nAGENTE FINAL (NOODE) -->", message);
      return { messages: [new AIMessage(`${lastMessage.content.toString()} `)] };
    })
    .addEdge("__start__", "llm")
    .addEdge("llm", "toolsEscopo")
    .addConditionalEdges(
      "toolsEscopo",
      (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const message = lastMessage?.content?.toString().toLowerCase();
        let next = "roteador";
        if (!listaEscopo.find((escopo) => message.toLocaleLowerCase() === escopo.toLocaleLowerCase())) {
          next = "agentFinal";
        }
        console.log("\nTOOLSESCOPO (CONDITIONAL) -->", next);
        return next;
      },
      ["roteador", "agentFinal"]
    )

    .addConditionalEdges(
      "roteador",
      (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        console.log("\nROTEADOR (CONDITIONAL) -->", lastMessage);
        const message = lastMessage?.content?.toString().toLowerCase();
        console.log("\nROTEADOR (CONDITIONAL) -->", message);
        if (message.includes("pedido")) return "toolsPedido";
        if (message.includes("cliente")) return "toolsCliente";
        throw new Error("Mensagem não reconhecida pelo roteador");
      },
      ["toolsPedido", "toolsCliente"]
    )
    .addEdge("toolsPedido", "agentFinal")
    .addEdge("toolsCliente", "agentFinal")
    .addEdge("agentFinal", "__end__")
    .compile();

  // Adicione esta linha para obter o grafo desenhável
  const drawableGraph = await workflow.getGraphAsync();

  //---------------------------------------------
  // 5. Execução
  //---------------------------------------------

  const input = {
    messages: [new HumanMessage("quero consultar um pedido")],
    //messages: [new HumanMessage("quero consultar um cliente")],
    //messages: [new HumanMessage("quero ver quantos trabalhadores a clamed tem")],
  };

  // Gere a imagem do grafo
  const graphStateImage = await drawableGraph.drawMermaidPng();
  const graphStateArrayBuffer = await graphStateImage.arrayBuffer();

  const filePath = "./graphState.png";
  writeFileSync(filePath, new Uint8Array(graphStateArrayBuffer));

  const responde = await workflow.invoke(input);
  console.log("Resposta final :", responde.messages[responde.messages.length - 1].content);
})();
