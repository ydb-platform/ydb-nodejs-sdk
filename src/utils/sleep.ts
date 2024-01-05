export const sleep = async (milliseconds: number) => {
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
};
