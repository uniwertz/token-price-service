# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-01-10

### Added
- Clean Architecture implementation with DDD principles
- Token price update service with Kafka integration
- Hybrid scheduling system for different environments
- GitOps support with Kustomize and ArgoCD
- Unit tests for core functionality
- Structured logging and OpenTelemetry integration
- Health checks and monitoring
- Docker and Kubernetes deployment configurations

### Changed
- Migrated from TypeORM to Prisma
- Refactored domain entities with proper DDD naming
- Replaced custom retry logic with p-retry library
- Improved error handling and validation

### Security
- Removed hardcoded credentials from configuration files
- Added proper .gitignore for environment files
- Implemented Kubernetes Secrets for sensitive data

### Infrastructure
- Added GitOps manifests for automated deployment
- Created environment-specific overlays
- Implemented proper resource limits and health checks
