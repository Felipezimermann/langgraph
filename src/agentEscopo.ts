import "dotenv/config";
import { writeFileSync } from "node:fs";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";

import ToolEscopo from "./tools/ToolEscopo";
import ToolPedido from "./tools/ToolPedido";
import AgentOpenAI from "./agents/AgentOpenAI";

//---------------------------------------------
// 1. Definição das Tools
//---------------------------------------------

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

  const agentOpenAI = new AgentOpenAI();

  /**
   * Area das tools
   * Aqui você pode definir as ferramentas que serão utilizadas pelo agente.
   */
  const toolsEscopo = new ToolEscopo();
  const toolsPedido = new ToolPedido();

  /**
   * Criação dos agentes
   * Aqui você cria os agentes que serão utilizados no workflow.
   */
  const agentEscopo = agentOpenAI.create([toolsEscopo.getEscopo]);
  const agentPedido = agentOpenAI.create([toolsPedido.getPedido]);

  //---------------------------------------------
  // 2. Definição do Workflow
  //---------------------------------------------

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("toolsEscopo", toolsEscopo.node)
    .addNode("toolsPedido", toolsPedido.node)
    .addNode("llm", (state) => agentOpenAI.call(state, agentEscopo))
    .addNode("agentPedido", (state) => agentOpenAI.call(state, agentPedido))
    .addEdge("__start__", "llm")
    .addEdge("llm", "toolsEscopo")
    .addConditionalEdges(
      "toolsEscopo",
      (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const escopo = lastMessage.content.toString().toLowerCase().trim();

        if (escopo === "pedido") {
          return "agentPedido";
        }
        return "__end__";
      },
      ["agentPedido", "__end__"]
    )
    .addEdge("agentPedido", "toolsPedido")
    .addEdge("toolsPedido", "__end__")

    .compile();

  // Adicione esta linha para obter o grafo desenhável
  const drawableGraph = await workflow.getGraphAsync();

  //---------------------------------------------
  // 5. Execução
  //---------------------------------------------

  // const rl = readline.createInterface({
  //   input: process.stdin,
  //   output: process.stdout,
  // });
  // let messages = [] as any;
  // function askQuestion() {
  //   rl.question("> ", async (input) => {
  //     console.log("Você:", input);
  //     messages.push(new AIMessage(input));
  //     const state = await workflow.invoke({ messages });
  //     const lastMessage = state.messages[state.messages.length - 1];

  //     // Print resposta da IA
  //     console.log("🤖:", lastMessage.content);

  //     // Atualiza mensagens para manter o contexto
  //     messages = state.messages;

  //     // Continua perguntando
  //     askQuestion();
  //   });
  // }

  // askQuestion();

  const input = {
    messages: [new HumanMessage("Quero consultar um pedido")],
    //messages: [new HumanMessage("quero consultar um cliente")],
    //messages: [new HumanMessage("quero ver quantos trabalhadores a clamed tem")],
  };

  //Gere a imagem do grafo
  const graphStateImage = await drawableGraph.drawMermaidPng();
  const graphStateArrayBuffer = await graphStateImage.arrayBuffer();

  const filePath = "./graphState.png";
  writeFileSync(filePath, new Uint8Array(graphStateArrayBuffer));

  const responde = await workflow.invoke(input);
  console.log("Resposta final:", responde.messages[responde.messages.length - 1].content);
})();
