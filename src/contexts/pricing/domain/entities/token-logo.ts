export class TokenLogo {
  private constructor(
    public readonly id: string,
    public readonly tokenId: string | null,
    public readonly largeImagePath: string,
    public readonly mediumImagePath: string,
    public readonly thumbnailPath: string,
  ) {}

  static restore(params: {
    id: string;
    tokenId: string | null;
    largeImagePath: string;
    mediumImagePath: string;
    thumbnailPath: string;
  }) {
    return new TokenLogo(
      params.id,
      params.tokenId,
      params.largeImagePath,
      params.mediumImagePath,
      params.thumbnailPath,
    );
  }
}
