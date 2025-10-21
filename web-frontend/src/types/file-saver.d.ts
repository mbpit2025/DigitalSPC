declare module 'file-saver' {
    // 1. Define a specific interface for the optional 'options' parameter
    //    based on what file-saver typically accepts (e.g., for Blob options).
    interface SaveAsOptions {
        type?: string;
        lastModified?: number;
    }

    // 2. Specify the types for the saveAs function without using 'any'
    export function saveAs(
        data: Blob | File | string, 
        filename?: string, 
        options?: SaveAsOptions
    ): void;
}