# Multi Agent App

## Project Overview

This project aims to create a multi-agent application that exposes an API and a frontend SPA interface. Agents will be able to collaborate and use external tools (via MCP servers), such as databases or math engines, to fulfill user requests.

## What are LangGraph / LangChain

Used for orchestrating multi-agent workflows and tool usage, enabling agents to reason, plan, and call tools as needed.

## What is MCP?

Allow agents to communicate with external tools (e.g., database, math server) via a unified protocol.

## Project Scope

2. Multi-Agent Orchestration

   - Define agent roles and responsibilities
   - Enable agents to collaborate and delegate tasks
   - Support for agent-to-agent communication

3. Tool Integration

   - Database tool (query, describe, list tables)
   - Math tool (basic calculations)
   - Extensible interface for adding new MCP tools

4. API Endpoints

   - Start new chat/thread
   - Send messages and receive agent responses
   - Retrieve thread history

5. Frontend SPA

   - Chat interface for interacting with agents
   - Display tool results (tables, lists, etc.)
   - Thread management

## Technical Architecture

### Core Components

1. API Server (FastAPI)
2. Multi-Agent Orchestrator (LangGraph)
3. Resource Adapters
   - Database Adapter (MCP)
   - Math Adapter (MCP)
4. Frontend SPA (Next.js/React)

### Technology stack

- **API Framework**: FastAPI
- **Async Support**: Asyncio
- **Testing**: Pytest
- **Documentation**: OpenAPI (Swagger UI)
- **Frontend**: Next.js, React, TailwindCSS

## Security Considerations

- Input validation and SQL Injection prevention (especially for database tool)

## Performance Goals

- Low latency responses (<200ms for typical queries)
- Caching layer for frequently accessed data
- Asynchronous processing for non-blocking operations
- Scalable agent orchestration
