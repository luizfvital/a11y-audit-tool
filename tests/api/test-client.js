export async function createTestClient(app) {
  return {
    async request(path, options = {}) {
      return new Promise((resolve, reject) => {
        const headers = Object.fromEntries(
          Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value])
        );
        const chunks = [];
        const request = {
          method: options.method ?? "GET",
          url: path,
          headers,
          body: options.body,
          connection: {},
          socket: {}
        };
        const response = {
          statusCode: 200,
          headersSent: false,

          setHeader(name, value) {
            headers[name.toLowerCase()] = value;
          },

          getHeader(name) {
            return headers[name.toLowerCase()];
          },

          removeHeader(name) {
            delete headers[name.toLowerCase()];
          },

          write(chunk) {
            const normalizedChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
            chunks.push(normalizedChunk);
          },

          end(chunk) {
            if (chunk !== undefined) {
              this.write(chunk);
            }

            this.headersSent = true;

            const rawBody = Buffer.concat(chunks).toString();
            const contentType = this.getHeader("content-type") ?? "";
            const body = contentType.includes("application/json") && rawBody.length > 0
              ? JSON.parse(rawBody)
              : rawBody;

            resolve({
              status: this.statusCode,
              body,
              headers: {
                get: (name) => this.getHeader(name)
              }
            });
          }
        };

        app.handle(request, response, reject);
      });
    },

    async close() {}
  };
}
