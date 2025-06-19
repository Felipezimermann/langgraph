import "dotenv/config";
import { TavilySearch } from "@langchain/tavily";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

(async () => {
  // Define the tools for the agent to use
  const tools = [new TavilySearch({ maxResults: 3, tavilyApiKey: process.env.TAVILY_API_KEY })];
  const toolNode = new ToolNode(tools);

  // Create a model and give it access to the tools
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: 1000,
    temperature: 0.9,
    verbose: false,
  }).bindTools(tools);

  // Define the function that determines whether to continue or not
  function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    // Otherwise, we stop (reply to the user) using the special "__end__" node
    return "__end__";
  }

  // Define the function that calls the model
  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);

    // We return a list, because this will get added to the existing list
    return { messages: [response] };
  }

  // Define a new graph
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("toolsEscopo", toolNode)
    .addNode("toolsPedido", toolNode)
    .addNode("toolsCliente", toolNode)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
    .addEdge("tools", "agent")
    .addConditionalEdges("agent", shouldContinue);

  // Finally, we compile it into a LangChain Runnable.
  const app = workflow.compile();

  // Use the agent
  const finalState = await app.invoke({
    messages: [new HumanMessage("quem é mia kalifa?")],
  });
  console.log(finalState.messages[finalState.messages.length - 1].content);

  const nextState = await app.invoke({
    // Including the messages from the previous run gives the LLM context.
    // This way it knows we're asking about the weather in NY
    messages: [...finalState.messages, new HumanMessage("da onde ela é?")],
  });
  console.log(nextState.messages[nextState.messages.length - 1].content);
})();
