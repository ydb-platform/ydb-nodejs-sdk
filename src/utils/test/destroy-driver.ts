import Driver from "../../driver";

export async function destroyDriver(driver: Driver): Promise<void> {
    if (driver) {
        await driver.destroy();
    }
}
