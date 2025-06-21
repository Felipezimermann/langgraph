import "dotenv/config";
import { writeFileSync } from "node:fs";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

import ToolEscopo from "./tools/ToolEscopo";
import ToolPedido from "./tools/ToolPedido";
import AgentOpenAI from "./agents/AgentOpenAI";
import askQuestion from "./terminal";

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
  const agentFinal = agentOpenAI.create([]);
  //---------------------------------------------
  // 2. Definição do Workflow
  //---------------------------------------------

  const listAgents = ["agent_pedido"];
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("toolsEscopo", toolsEscopo.node)
    .addNode("toolsPedido", toolsPedido.node)
    .addNode("agent_escopo", (state) => agentOpenAI.call(state, agentEscopo))
    .addNode("agent_pedido", (state) => agentOpenAI.call(state, agentPedido))
    .addNode("agent_final", (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const message = lastMessage.content.toString().toLowerCase().trim();
      console.log("Messange antes do agent final: ", message);
      const input = new SystemMessage(
        `Voce é um assistente de IA que revisa todas as perguntas e respostas, e se verificar que ouve algum erro
         , você deve informar que não pode responder a pergunta e que o usuário deve entrar em 
         contato com o suporte. se tudo estiver ok, voce apenas repete a resposta do agente anterior sem alterar nada.`
      );
      state.messages.push(input);
      return agentOpenAI.call(state, agentFinal);
    })
    .addEdge("__start__", "agent_escopo")
    .addEdge("agent_escopo", "toolsEscopo")
    .addConditionalEdges(
      "toolsEscopo",
      (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const escopo = lastMessage.content.toString().toLowerCase().trim();
        if (!listAgents.find((value) => value.toLocaleLowerCase() === escopo.toLocaleLowerCase())) {
          return "agent_final";
        }
        return escopo;
      },
      ["agent_pedido", "agent_final"]
    )

    .addEdge("agent_pedido", "toolsPedido")
    .addEdge("toolsPedido", "agent_final")
    .addEdge("agent_final", "__end__")

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
    messages: [new HumanMessage("Quero consultar um pedido numero 123456")],
    //messages: [new HumanMessage("Quero saber aonde eu encontro um posto de gasulina")],
    //messages: [new HumanMessage("quero consultar um cliente")],
    //messages: [new HumanMessage("quero ver quantos trabalhadores a clamed tem")],
  };

  //Gere a imagem do grafo
  const graphStateImage = await drawableGraph.drawMermaidPng();
  const graphStateArrayBuffer = await graphStateImage.arrayBuffer();

  const filePath = "./graphState.png";
  writeFileSync(filePath, new Uint8Array(graphStateArrayBuffer));

  askQuestion(workflow);
  //const responde = await workflow.invoke(input);
  //console.log("Resposta final:", responde.messages[responde.messages.length - 1].content);
})();
