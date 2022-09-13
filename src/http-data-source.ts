import { STATUS_CODES } from 'http'
import { EventEmitter } from 'stream'

import QuickLRU from '@alloc/quick-lru'
import { DataSource, DataSourceConfig } from 'apollo-datasource'
import { toApolloError } from 'apollo-server-errors'
import { Logger } from 'apollo-server-types'
import { Pool } from 'undici'
import Dispatcher, { HttpMethod, ResponseData } from 'undici/types/dispatcher'

type AbortSignal = unknown

export class RequestError<T = unknown> extends Error {
  constructor(
    public message: string,
    public code: number,
    public request: Request,
    public response: Response<T>,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

interface Dictionary<T> {
  [Key: string]: T | undefined
}

export type RequestOptions = Omit<
  Partial<Request>,
  'origin' | 'path' | 'method'
>

export type Request<T = unknown> = {
  context: Dictionary<string>
  query: Dictionary<string | number>
  body: T
  signal?: AbortSignal | EventEmitter | null
  json?: boolean
  origin: string
  path: string
  method: HttpMethod
  // Indicates if the response of this request should be memoized
  memoize?: boolean
  headers: Dictionary<string>
}

export type Response<TResult> = {
  body: TResult
  memoized: boolean
  isFromCache: boolean
  // maximum ttl (seconds)
  maxTtl?: number
} & Omit<ResponseData, 'body'>

export interface LRUOptions {
  readonly maxAge?: number
  readonly maxSize: number
}

export interface HTTPDataSourceOptions {
  logger?: Logger
  pool?: Pool
  requestOptions?: RequestOptions
  clientOptions?: Pool.Options
  lru?: Partial<LRUOptions>
}

// rfc7231 6.1
// We only cache status codes that indicates a successful response
// We don't cache redirects, client errors because we expect to cache JSON payload.
const statusCodeCacheableByDefault = new Set([200, 203])

/**
 * HTTPDataSource is an optimized HTTP Data Source for Apollo Server
 * It focus on reliability and performance.
 */
export abstract class HTTPDataSource<TContext = unknown> extends DataSource {
  public context!: TContext
  private pool: Pool
  private logger?: Logger
  private globalRequestOptions?: RequestOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly memoizedResults: QuickLRU<string, Promise<Response<any>>>

  constructor(
    public readonly baseURL: string,
    private readonly options?: HTTPDataSourceOptions,
  ) {
    super()
    this.memoizedResults = new QuickLRU({
      // The maximum number of items before evicting the least recently used items.
      maxSize: this.options?.lru?.maxSize || 100,
      // The maximum number of milliseconds an item should remain in cache.
      // By default maxAge will be Infinity, which means that items will never expire.
      maxAge: this.options?.lru?.maxAge,
    })
    this.pool = options?.pool ?? new Pool(this.baseURL, options?.clientOptions)
    this.globalRequestOptions = options?.requestOptions
    this.logger = options?.logger
  }

  private buildQueryString(query: Dictionary<string | number>): string {
    const params = new URLSearchParams()
    for (const key in query) {
      if (Object.prototype.hasOwnProperty.call(query, key)) {
        const value = query[key]
        if (value !== undefined) {
          params.append(key, value.toString())
        }
      }
    }

    // avoid cache fragmentation when the query order is not guaranteed
    params.sort()

    return params.toString()
  }

  /**
   * Initialize the datasource with apollo internals (context, cache).
   *
   * @param config
   */
  initialize(config: DataSourceConfig<TContext>): void {
    this.context = config.context
  }

  protected isResponseOk(statusCode: number): boolean {
    return statusCode >= 200 && statusCode <= 399
  }

  protected isResponseCacheable<TResult = unknown>(
    request: Request,
    response: Response<TResult>,
  ): boolean {
    return (
      statusCodeCacheableByDefault.has(response.statusCode) &&
      this.isRequestCacheable(request)
    )
  }

  protected isRequestCacheable(request: Request): boolean {
    // default behaviour is to cache only get requests
    // If extending to non GET requests take care to provide an adequate onCacheKeyCalculation and isResponseCacheable
    return request.method === 'GET'
  }

  /**
   * Checks if the GET request is memoizable. This validation is performed before the
   * response is set in **memoizedResults**.
   * @param request
   * @returns *true* if request should be memoized
   */
  protected isRequestMemoizable(request: Request): boolean {
    return Boolean(request.memoize) && request.method === 'GET'
  }

  /**
   * onCacheKeyCalculation returns the key for the GET request.
   * The key is used to memoize the request in the LRU cache.
   *
   * @param request
   * @returns
   */
  protected onCacheKeyCalculation(request: Request): string {
    return request.origin + request.path
  }

  /**
   * onRequest is executed before a request is made and isn't executed for memoized calls.
   * You can manipulate the request e.g to add/remove headers.
   *
   * @param request
   */
  protected async onRequest?(request: Dispatcher.RequestOptions): Promise<void>

  /**
   * onResponse is executed when a response has been received.
   * By default the implementation will throw for for unsuccessful responses.
   *
   * @param request
   * @param response
   */
  protected onResponse<TResult = unknown>(
    request: Request,
    response: Response<TResult>,
  ): Response<TResult> {
    if (this.isResponseOk(response.statusCode)) {
      return response
    }

    throw new RequestError(
      `Response code ${response.statusCode} (${
        STATUS_CODES[response.statusCode.toString()]
      })`,
      response.statusCode,
      request,
      response,
    )
  }

  protected onError?(_error: Error, requestOptions: Request): void

  /**
   * Execute a HTTP GET request.
   * Note that the **memoizedResults** and **cache** will be checked before request is made.
   * By default the received response will be memoized.
   *
   * @param path the path to the resource
   * @param requestOptions
   */
  public async get<TResult = unknown>(
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<Response<TResult>> {
    return this.request<TResult>({
      headers: {},
      query: {},
      body: null,
      memoize: true,
      context: {},
      ...requestOptions,
      method: 'GET',
      path,
      origin: this.baseURL,
    })
  }

  public async post<TResult = unknown>(
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<Response<TResult>> {
    return this.request<TResult>({
      headers: {},
      query: {},
      body: null,
      context: {},
      ...requestOptions,
      method: 'POST',
      path,
      origin: this.baseURL,
    })
  }

  public async delete<TResult = unknown>(
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<Response<TResult>> {
    return this.request<TResult>({
      headers: {},
      query: {},
      body: null,
      context: {},
      ...requestOptions,
      method: 'DELETE',
      path,
      origin: this.baseURL,
    })
  }

  public async put<TResult = unknown>(
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<Response<TResult>> {
    return this.request<TResult>({
      headers: {},
      query: {},
      body: null,
      context: {},
      ...requestOptions,
      method: 'PUT',
      path,
      origin: this.baseURL,
    })
  }

  public async patch<TResult = unknown>(
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<Response<TResult>> {
    return this.request<TResult>({
      headers: {},
      query: {},
      body: null,
      context: {},
      ...requestOptions,
      method: 'PATCH',
      path,
      origin: this.baseURL,
    })
  }

  protected async parseBody<T>(response: Dispatcher.ResponseData): Promise<T> {
    const body = response.body
    const statusCode = response.statusCode
    const headers = response.headers
    const contentType = headers['content-type']
    const contentLength = headers['content-length']

    if (
      statusCode !== 204 &&
      contentLength !== '0' &&
      contentType &&
      (contentType.startsWith('application/json') ||
        contentType.endsWith('+json'))
    ) {
      return body.json()
    } else {
      return body.text() as Promise<T>
    }
  }

  private async performRequest<TResult>(
    request: Request,
  ): Promise<Response<TResult>> {
    try {
      // do the request
      if (request.body !== null && typeof request.body === 'object') {
        // in case of JSON set appropriate content-type header
        if (request.headers['content-type'] === undefined) {
          request.headers['content-type'] = 'application/json; charset=utf-8'
        }
        request.body = JSON.stringify(request.body)
      }

      const requestOptions: Dispatcher.RequestOptions = {
        method: request.method,
        origin: request.origin,
        path: request.path,
        headers: request.headers,
        signal: request.signal,
        body: request.body as string,
      }

      await this.onRequest?.(requestOptions)

      const responseData = await this.pool.request(requestOptions)

      const body = await this.parseBody<TResult>(responseData)

      const response: Response<TResult> = {
        ...responseData,
        body,
        isFromCache: false,
        memoized: false,
      }

      this.onResponse<TResult>(request, response)

      return response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.onError?.(error, request)
      throw toApolloError(error)
    }
  }

  private async request<TResult = unknown>(
    request: Request,
  ): Promise<Response<TResult>> {
    const options: Request = {
      ...this.globalRequestOptions,
      ...request,
      headers: {
        ...(this.globalRequestOptions?.headers || {}),
        ...request.headers,
      },
    }

    if (Object.keys(options.query).length > 0) {
      options.path = options.path + '?' + this.buildQueryString(options.query)
    }

    const cacheKey = this.onCacheKeyCalculation(options)

    const isRequestMemoizable = this.isRequestMemoizable(options)

    // check if we have a memoizable call in the cache to respond immediately
    if (isRequestMemoizable) {
      // Memoize calls for the same data source instance
      // a single instance of the data sources is scoped to one graphql request
      let promise = this.memoizedResults.get(cacheKey)
      if (promise) {
        return { ...(await promise), memoized: true }
      }
      promise = this.trace(options, () => this.performRequest<TResult>(options))
      this.memoizedResults.set(cacheKey, promise)
      return promise
    } else {
      this.memoizedResults.delete(cacheKey)
      const promise = this.trace(options, () =>
        this.performRequest<TResult>(options),
      )
      return promise
    }
  }

  protected async trace<TResult>(
    request: Request,
    fn: () => Promise<TResult>,
  ): Promise<TResult> {
    if (process.env.NODE_ENV === 'development') {
      const startTime = Date.now()
      try {
        return await fn()
      } finally {
        const duration = Date.now() - startTime
        const label = `${request.method || 'GET'} ${request.path}`
        // eslint-disable-next-line no-console
        console.debug(`${label} (${duration}ms)`)
      }
    } else {
      return fn()
    }
  }
}
