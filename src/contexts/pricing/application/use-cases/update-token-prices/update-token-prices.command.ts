/**
 * APPLICATION LAYER — Command (CQRS)
 *
 * UpdateTokenPricesCommand представляет запрос на обновление цен всех токенов.
 * Следует паттерну CQRS (Command Query Responsibility Segregation).
 *
 * Ключевые принципы:
 * - Иммутабельная структура данных
 * - Содержит всю информацию, необходимую для выполнения use case
 * - Может включать метаданные (кто инициировал)
 * - Удобен для аудита и авторизации
 *
 * Команды выражают «намерение выполнить действие» и обрабатываются handlers.
 *
 * Пример:
 * ```typescript
 * const command = new UpdateTokenPricesCommand('scheduler');
 * await handler.execute(command);
 * ```
 */
export class UpdateTokenPricesCommand {
	/**
	 * Создать команду обновления цен
	 * @param triggeredBy — кто/что инициировал команду (для аудита)
	 */
	constructor(public readonly triggeredBy: string = 'system') {}
}
