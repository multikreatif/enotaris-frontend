declare module '@keenthemes/ktui' {
  export class KTDataTable {
    constructor(element: HTMLElement, options: KTDataTableOptions);
    dispose(): void;
    reload(): void;
    on(eventType: string, callback: () => void): string;
    off(eventType: string, eventId: string): void;
    static getInstance?(element: HTMLElement): KTDataTable | null;
  }

  export interface KTDataTableOptions {
    apiEndpoint?: string;
    requestMethod?: string;
    requestHeaders?: Record<string, string>;
    pageSize?: number;
    pageSizes?: number[];
    stateSave?: boolean;
    search?: { delay?: number };
    infoEmpty?: string;
    info?: string;
    mapRequest?: (query: URLSearchParams) => URLSearchParams;
    mapResponse?: (res: { data?: unknown[]; totalCount?: number }) => { data: unknown[]; totalCount: number };
    columns?: Record<string, KTDataTableColumn>;
  }

  export interface KTDataTableColumn {
    render?: (value: unknown, rowData?: Record<string, unknown>) => string;
    createdCell?: (cell: HTMLElement, cellData: unknown, rowData: Record<string, unknown>) => void;
  }
}
