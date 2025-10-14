export class Chain {
  private constructor(
    public readonly id: string,
    public readonly deploymentId: number,
    public readonly name: string,
    public readonly isEnabled: boolean,
  ) {}

  static restore(params: { id: string; deploymentId: number; name: string; isEnabled: boolean }) {
    return new Chain(params.id, params.deploymentId, params.name, params.isEnabled);
  }
}
