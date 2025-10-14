export interface InitialDataRepositoryPort {
  seed(author: string): Promise<void>;
}

export const INITIAL_DATA_REPOSITORY_PORT = Symbol('INITIAL_DATA_REPOSITORY_PORT');
