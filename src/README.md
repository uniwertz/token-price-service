# Token Price Service - Source Code

This directory contains the source code for the Token Price Service, a production-ready NestJS application built with Clean Architecture and Domain-Driven Design principles.

## Architecture Overview

The application follows Clean Architecture with clear separation of concerns:

- **Domain Layer**: Core business logic, entities, and value objects
- **Application Layer**: Use cases and application services
- **Infrastructure Layer**: External dependencies (database, messaging, HTTP clients)
- **Interface Layer**: REST controllers and API endpoints

## Key Features

- **Clean Architecture**: Separation of concerns with dependency inversion
- **Domain-Driven Design**: Rich domain models with business logic encapsulation
- **Type Safety**: Full TypeScript with strict typing and validation
- **Production Ready**: Structured logging, telemetry, retry mechanisms, graceful shutdown
- **GitOps Ready**: Kubernetes manifests and deployment configurations

## Project Structure

```
src/
├── app/                    # Application configuration
│   └── config/            # Environment validation and config
├── contexts/              # Bounded contexts (DDD)
│   └── pricing/           # Pricing domain context
│       ├── domain/        # Domain entities, value objects, ports
│       ├── application/   # Use cases and handlers
│       ├── infrastructure/ # Adapters and external services
│       └── interface/     # REST controllers
├── shared/                # Shared kernel
│   ├── domain/           # Shared value objects
│   ├── infrastructure/   # Shared infrastructure services
│   ├── kernel/           # Domain events, ports
│   └── utils/            # Utility functions
├── services/             # Legacy services (being migrated)
└── kafka/               # Kafka producer service
```

## Development

For development instructions, see the main [README.md](../README.md) in the project root.

## Code Quality

- **No console.log**: Uses structured logging throughout
- **Type Safety**: Minimal use of `any` types
- **Error Handling**: Proper error handling with retry mechanisms
- **Testing**: Unit tests for critical components
- **Documentation**: Clear interfaces and domain models
