import { Client } from '@elastic/elasticsearch';

export interface ElasticsearchClientOptions {
  url: string;
  auth?: string;
  apiKey?: string;
}

/**
 * Creates an Elasticsearch client with proper authentication configuration
 * Supports both username/password and API key authentication
 * API key takes precedence over username/password if both are provided
 */
export function createElasticsearchClient(options: ElasticsearchClientOptions): Client {
  const clientConfig: any = {
    node: options.url
  };

  if (options.apiKey) {
    // API key authentication takes precedence
    clientConfig.auth = { apiKey: options.apiKey };
  } else if (options.auth && options.auth.includes(':')) {
    // Username/password authentication
    const [username, password] = options.auth.split(':');
    clientConfig.auth = { username, password };
  }
  // If neither API key nor valid auth string is provided, client will use no auth

  return new Client(clientConfig);
}