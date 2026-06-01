// factories/holiday.factory.ts
import { faker } from "@faker-js/faker";

// This matches the generated interface from sql-ts
export interface HolidayEntity {
  CreatedBy?: string | null;
  CreatedOn?: Date | null;
  Date?: Date | null;
  GCRecord?: number | null;
  IsFixed?: boolean | null;
  Name?: string | null;
  Oid: string;
  OptimisticLockField?: number | null;
  UpdatedBy?: string | null;
  UpdatedOn?: Date | null;
}

/**
 * Generate a single HolidayEntity with realistic-looking data.
 * Pass partial overrides to control any field.
 */
export function createHoliday(overrides: Partial<HolidayEntity> = {}): HolidayEntity {
  const createdOn = faker.date.past({ years: 2 });

  return {
    CreatedBy: faker.person.fullName(),
    CreatedOn: createdOn,
    Date: faker.date.future({ years: 1 }),
    GCRecord: null, // null = not soft-deleted in DevExpress XPO
    IsFixed: faker.datatype.boolean(),
    Name: `${faker.date.month()} ${faker.helpers.arrayElement([
      "Bank Holiday",
      "National Day",
      "Public Holiday",
      "Observance",
      "Memorial Day",
      "Independence Day",
    ])}`,
    Oid: faker.string.uuid(),
    OptimisticLockField: faker.number.int({ min: 0, max: 100 }),
    UpdatedBy: faker.person.fullName(),
    UpdatedOn: faker.date.between({ from: createdOn, to: new Date() }),
    ...overrides,
  };
}

/**
 * Generate an array of HolidayEntity objects.
 */
export function createHolidays(
  count: number,
  overrides: Partial<HolidayEntity> = {}
): HolidayEntity[] {
  return Array.from({ length: count }, () => createHoliday(overrides));
}