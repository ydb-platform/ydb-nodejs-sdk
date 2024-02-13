export function removeProtocol(endpoint: string) {
    const re = /^(grpc:\/\/|grpcs:\/\/)?(.+)/;
    const match = re.exec(endpoint) as string[];
    return match[2];
}
