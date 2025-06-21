import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI, ChatOpenAIFields } from "@langchain/openai";
import { Runnable } from "@langchain/core/runnables";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAICallOptions } from "@langchain/openai";
import { MessagesAnnotation } from "@langchain/langgraph";

class AgentOpenAI {
  private settings: ChatOpenAIFields;

  constructor() {
    this.settings = {
      modelName: "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY,
      maxTokens: 1000,
      temperature: 0.9,
    };
  }

  create(tools: DynamicStructuredTool[]) {
    const agentModel = new ChatOpenAI(this.settings);
    return agentModel.bindTools(tools);
  }

  async call(state: typeof MessagesAnnotation.State, agent: Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOpenAICallOptions>) {
    const response = await agent.invoke(state.messages);
    return { messages: [...state.messages, response] };
  }
}

export default AgentOpenAI;
