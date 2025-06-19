import "dotenv/config";

process.env.TAVILY_API_KEY = "tvly-...";

import { TavilySearch } from "@langchain/tavily";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

(async () => {
  // Define the tools for the agent to use

  const agentTools = [
    new TavilySearch({
      maxResults: 3,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      includeDomains: ["clamed.com.br"], // Restringe buscas ao domínio clamed.com.br
    }),
  ];
  const agentModel = new ChatOpenAI({ modelName: "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY, maxTokens: 1000, temperature: 0.9, verbose: false });

  // Initialize memory to persist state between graph runs
  const agentCheckpointer = new MemorySaver();
  const agent = createReactAgent({
    llm: agentModel,
    tools: agentTools,
    checkpointSaver: agentCheckpointer,
  });

  // Now it's time to use!
  // Mensagem inicial reforçando o contexto do assistente
  const agentFinalState = await agent.invoke(
    {
      messages: [new HumanMessage("Você é um assistente que responde apenas perguntas relacionadas ao site clamed.com.br e só busca informações nesse site.")],
    },
    { configurable: { thread_id: "42" } }
  );

  console.log(agentFinalState.messages[agentFinalState.messages.length - 1].content);

  const agentNextState = await agent.invoke(
    {
      messages: [new HumanMessage("Responda apenas se a informação estiver disponível no site clamed.com.br: Qual é o número de telefone da Clamed?")],
    },
    { configurable: { thread_id: "42" } }
  );

  console.log(agentNextState.messages[agentNextState.messages.length - 1].content);
})();
