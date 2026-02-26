/**
 * Base mapper for converting between domain entities and persistence models.
 * Provides mapping infrastructure for domain-driven design.
 *
 * @template TDomain - Domain entity type
 * @template TPersistence - Persistence/database model type
 */
export abstract class BaseMapper<TDomain, TPersistence> {
  /**
   * Maps a persistence model to a domain entity.
   * Override this method with specific mapping logic.
   *
   * @param raw - Persistence model
   * @returns Domain entity
   */
  abstract toDomain(raw: TPersistence): TDomain;

  /**
   * Maps a domain entity to a persistence model.
   * Override this method with specific mapping logic.
   *
   * @param domain - Domain entity
   * @returns Persistence model
   */
  abstract toPersistence(domain: TDomain): TPersistence;

  /**
   * Maps an array of persistence models to domain entities.
   *
   * @param raw - Array of persistence models
   * @returns Array of domain entities
   */
  toDomainArray(raw: TPersistence[]): TDomain[] {
    return raw.map((item) => this.toDomain(item));
  }

  /**
   * Maps an array of domain entities to persistence models.
   *
   * @param domain - Array of domain entities
   * @returns Array of persistence models
   */
  toPersistenceArray(domain: TDomain[]): TPersistence[] {
    return domain.map((item) => this.toPersistence(item));
  }
}
