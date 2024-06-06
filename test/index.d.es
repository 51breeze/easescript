///<scope name='local' />
///<reference file='file'/>
///<reference file='./assert.d.es'/>
declare interface Matchers {
       
    message(): any;

    /**
        * Expect the actual value to be `===` to the expected value.
        *
        * @param expected The expected value to compare against.
        * @param expectationFailOutput
        * @example
        * expect(thing).toBe(realThing);
        */
    toBe(expected:any, expectationFailOutput?:any): boolean;

    /**
        * Expect the actual value to be equal to the expected, using deep equality comparison.
        * @param expected Expected value.
        * @param expectationFailOutput
        * @example
        * expect(bigObject).toEqual({ "foo": ['bar', 'baz'] });
        */
    toEqual(expected:any, expectationFailOutput?:any): boolean;

    /**
        * Expect the actual value to match a regular expression.
        * @param expected Value to look for in the string.
        * @example
        * expect("my string").toMatch(/string$/);
        * expect("other string").toMatch("her");
        */
    toMatch(expected: string | RegExp, expectationFailOutput?:any): boolean;

    toBeDefined(expectationFailOutput?:any): boolean;
    toBeUndefined(expectationFailOutput?:any): boolean;
    toBeNull(expectationFailOutput?:any):boolean;
    toBeNaN(): boolean;
    toBeTruthy(expectationFailOutput?:any): boolean;
    toBeFalsy(expectationFailOutput?:any): boolean;
    toBeTrue(): boolean;
    toBeFalse(): boolean;
    toHaveBeenCalled(): boolean;
    toHaveBeenCalledBefore(expected): boolean;
    toHaveBeenCalledWith(...params:any[]): boolean;
    toHaveBeenCalledOnceWith(...params:any[]): boolean;
    toHaveBeenCalledTimes(expected: number): boolean;
    toContain(expected: any, expectationFailOutput?:any): boolean;
    toBeLessThan(expected: number, expectationFailOutput?:any): boolean;
    toBeLessThanOrEqual(expected: number, expectationFailOutput?:any): boolean;
    toBeGreaterThan(expected: number, expectationFailOutput?:any): boolean;
    toBeGreaterThanOrEqual(expected: number, expectationFailOutput?:any): boolean;
    toBeCloseTo(expected: number, precision:any, expectationFailOutput?:any): boolean;
    toThrow(expected: any): boolean;
    toThrowError(expected, message:string | RegExp): boolean;
    toThrowMatching(predicate: (thrown: any) => boolean): boolean;
    toBeNegativeInfinity(expectationFailOutput?:any): boolean;
    toBePositiveInfinity(expectationFailOutput?:any): boolean;
    toBeInstanceOf(expected:class): boolean;

    /**
        * Expect the actual value to be a DOM element that has the expected class.
        * @since 3.0.0
        * @param expected The class name to test for.
        * @example
        * var el = document.createElement('div');
        * el.className = 'foo bar baz';
        * expect(el).toHaveClass('bar');
        */
    toHaveClass(expected: string, expectationFailOutput?:any): boolean;

    /**
        * Expect the actual size to be equal to the expected, using array-like
        * length or object keys size.
        * @since 3.6.0
        * @param expected The expected size
        * @example
        * array = [1,2];
        * expect(array).toHaveSize(2);
        */
    toHaveSize(expected: number): boolean;

    /**
        * Add some context for an expect.
        * @param message Additional context to show when the matcher fails
        */
    withContext(message: string): Matchers;

    /**
        * Invert the matcher following this expect.
        */
    not: Matchers;
}


declare function it(title:string,callback:(done?:()=>void)=>void):int;

declare function expect(result:any):Matchers;

declare class jasmine {
   public static var DEFAULT_TIMEOUT_INTERVAL:int
}


declare interface Tname {
    name:string,
    age?:number,
    test():void
}


declare interface DynamicProperty {
   [key:string]:any
   [index:number]:number
   name?:string
}

// package net{
    
//     declare interface HttpBasicCredentials {
//         username: string;
//         password: string;
//     }

//     declare interface HttpProxyConfig {
//         host: string;
//         port: number;
//         auth?:HttpBasicCredentials
//     }

//     declare interface HttpResponse<T = any>  {
//         data: T;
//         status: number;
//         statusText: string;
//         headers: any;
//         config: HttpConfig;
//         request?: any;
//     }

//     declare interface HttpPromise<T = any> extends Promise< HttpResponse<T> > {}

//     declare interface HttpInterceptorManager<V> {
//         use(onFulfilled?: (value: V) => V | Promise<V>, onRejected?: (error: any) => any): number;
//         eject(id: number): void;
//     }

//     declare class HttpAdapter {
//         constructor(config: HttpConfig): HttpPromise<any>;
//     }

//     declare class HttpTransformer {
//         @Callable
//         constructor(data: any, headers?: any): any;
//     }

//     declare interface HttpCancelToken {
//         promise: Promise<HttpCancel>;
//         reason?: HttpCancel;
//         throwIfRequested(): void;
//     }

//     declare class HttpCancelStatic {
//         @Callable
//         constructor(message?: string): HttpCancel;
//     }

//     declare interface HttpCancel {
//         message: string;
//     }

//     declare class HttpCanceler {
//         @Callable
//         constructor(message?: string): void;
//     }

//     declare class HttpCancelTokenStatic {
//         constructor(executor: (cancel: HttpCanceler) => void): HttpCancelToken;
//         source(): HttpCancelTokenSource;
//     }

//     declare interface HttpCancelTokenSource {
//         token: HttpCancelToken;
//         cancel: HttpCanceler;
//     }

//     declare interface HttpConfig {
//         url?: string;
//         method?: string;
//         baseURL?: string;
//         transformRequest?: HttpTransformer | HttpTransformer[];
//         transformResponse?: HttpTransformer | HttpTransformer[];
//         headers?: any;
//         params?: any;
//         paramsSerializer?: (params: any) => string;
//         data?: any;
//         timeout?: number;
//         withCredentials?: boolean;
//         adapter?: HttpAdapter;
//         auth?: HttpBasicCredentials;
//         responseType?: string;
//         xsrfCookieName?: string;
//         xsrfHeaderName?: string;
//         onUploadProgress?: (progressEvent: any) => void;
//         onDownloadProgress?: (progressEvent: any) => void;
//         maxContentLength?: number;
//         validateStatus?: (status: number) => boolean;
//         maxRedirects?: number;
//         httpAgent?: any;
//         httpsAgent?: any;
//         proxy?: HttpProxyConfig | false;
//         cancelToken?: HttpCancelToken;
//     }

//     declare class Http{

//         static create(config?:HttpConfig):Http;
//         static isCancel(value: any): boolean;
//         static all<T>(values: (T | Promise<T>)[]): Promise<T[]>;
//         static spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;

//         constructor(url: string | HttpConfig, config?: HttpConfig): HttpPromise;
//         defaults: HttpConfig;
//         interceptors: {
//             request: HttpInterceptorManager<HttpConfig>,
//             response: HttpInterceptorManager<HttpResponse>
//         };

//         request<T = any>(config: HttpConfig): HttpPromise<T>;
//         get<T = any>(url: string, config?: HttpConfig): HttpPromise<T>;
//         delete(url: string, config?: HttpConfig): HttpPromise;
//         head(url: string, config?: HttpConfig): HttpPromise;
//         post<T = any>(url: string, data?: any, config?: HttpConfig): HttpPromise<T>;
//         put<T = any>(url: string, data?: any, config?: HttpConfig): HttpPromise<T>;
//         patch<T = any>(url: string, data?: any, config?: HttpConfig): HttpPromise<T>;

//     }

// }






@Dynamic;
declare interface Window extends IEventDispatcher{
    const location:Location;
    const document:Document;
}
declare const window:Window;

@Dynamic;
declare interface Document extends IEventDispatcher{
    get activeElement():Node;
    get body():Node;
    get defaultView():Window;
    get head():Node;
    get title():Node;
    get images():Node[];
    get links():Node[];
    get location ():Location;
    get compatMode():'BackCompat' | 'CSS1Compat';
    get designMode():'on' | 'off';
    get contentType():any;
    get doctype():object;
    get documentElement():Document;
    get documentURI():string;
    get forms():HTMLCollection;
    requestFullscreen():void;
    createElement(name:string):Node;
    createTextNode(name:string):Node;
    createComment(name:string):Node;
    createDocumentFragment(name:string):Node;
    createAttribute():Attr;
    querySelector(selector:string):Node|null;
    querySelectorAll(selector:string):Node[];
    getElementById(name:string):Node;
}
declare const document:Document;

declare interface NodeList {
    /**
     * Returns the number of nodes in the collection.
     */
    const length: number;
    /**
     * Returns the node with index index from the collection. The nodes are sorted in tree order.
     */
    item(index: number): Node | null;
    /**
     * Performs the specified action for each node in an list.
     * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the list.
     * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
     */
    forEach(callbackfn: (value: Node, key: number, parent: NodeList) => void, thisArg?: any): void;
}

declare interface NodeListOf<TNode extends Node> extends NodeList {}

declare interface GetRootNodeOptions {
    var composed?: boolean;
}

declare class Node extends IEventDispatcher{

     /**
     * Returns node's node document's document base URL.
     */
    const baseURI: string;
    /**
     * Returns the children.
     */
    const childNodes: NodeListOf<ChildNode>;
    /**
     * Returns the first child.
     */
    const firstChild: ChildNode | null;
    /**
     * Returns true if node is connected and false otherwise.
     */
    const isConnected: boolean;
    /**
     * Returns the last child.
     */
    const lastChild: ChildNode | null;
    /**
     * Returns the next sibling.
     */
    const nextSibling: ChildNode | null;
    /**
     * Returns a string appropriate for the type of node.
     */
    const nodeName: string;
    /**
     * Returns the type of node.
     */
    const nodeType: number;
    const nodeValue: string | null;
    /**
     * Returns the node document. Returns null for documents.
     */
    const ownerDocument: Document | null;
    /**
     * Returns the parent element.
     */
    const parentElement: HTMLElement | null;
    /**
     * Returns the parent.
     */
    const parentNode: ParentNode | null;
    /**
     * Returns the previous sibling.
     */
    const previousSibling: ChildNode | null;
    const textContent: string | null;
    appendChild<T extends Node>(node: T): T;
    /**
     * Returns a copy of node. If deep is true, the copy also includes the node's descendants.
     */
    cloneNode(deep?: boolean): Node;
    /**
     * Returns a bitmask indicating the position of other relative to node.
     */
    compareDocumentPosition(other: Node): number;
    /**
     * Returns true if other is an inclusive descendant of node, and false otherwise.
     */
    contains(other: Node | null): boolean;
    /**
     * Returns node's root.
     */
    getRootNode(options?: GetRootNodeOptions): Node;
    /**
     * Returns whether node has children.
     */
    hasChildNodes(): boolean;
    insertBefore<T extends Node>(node: T, child: Node | null): T;
    isDefaultNamespace(namespace: string | null): boolean;
    /**
     * Returns whether node and otherNode have the same properties.
     */
    isEqualNode(otherNode: Node | null): boolean;
    isSameNode(otherNode: Node | null): boolean;
    lookupNamespaceURI(prefix: string | null): string | null;
    lookupPrefix(namespace: string | null): string | null;
    /**
     * Removes empty exclusive Text nodes and concatenates the data of remaining contiguous exclusive Text nodes into the first of their nodes.
     */
    normalize(): void;
    removeChild<T extends Node>(child: T): T;
    replaceChild<T extends Node>(node: Node, child: T): T;
    static const ATTRIBUTE_NODE: number;
    /**
     * node is a CDATASection node.
     */
    static const CDATA_SECTION_NODE: number;
    /**
     * node is a Comment node.
     */
    static const COMMENT_NODE: number;
    /**
     * node is a DocumentFragment node.
     */
    static const DOCUMENT_FRAGMENT_NODE: number;
    /**
     * node is a document.
     */
    static const DOCUMENT_NODE: number;
    /**
     * Set when other is a descendant of node.
     */
    static const DOCUMENT_POSITION_CONTAINED_BY: number;
    /**
     * Set when other is an ancestor of node.
     */
    static const DOCUMENT_POSITION_CONTAINS: number;
    /**
     * Set when node and other are not in the same tree.
     */
    static const DOCUMENT_POSITION_DISCONNECTED: number;
    /**
     * Set when other is following node.
     */
    static const DOCUMENT_POSITION_FOLLOWING: number;
    static const DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: number;
    /**
     * Set when other is preceding node.
     */
    static const DOCUMENT_POSITION_PRECEDING: number;
    /**
     * node is a doctype.
     */
    static const DOCUMENT_TYPE_NODE: number;
    /**
     * node is an element.
     */
    static const ELEMENT_NODE: number;
    static const ENTITY_NODE: number;
    static const ENTITY_REFERENCE_NODE: number;
    static const NOTATION_NODE: number;
    /**
     * node is a ProcessingInstruction node.
     */
    static const PROCESSING_INSTRUCTION_NODE: number;
    /**
     * node is a Text node.
     */
    static const TEXT_NODE: number;
}

/** A generic collection (array-like object similar to arguments) of elements (in document order) and offers methods and properties for selecting from the list. */
declare interface HTMLCollectionBase {
    /**
     * Sets or retrieves the number of objects in a collection.
     */
    length: number;
    /**
     * Retrieves an object from various collections.
     */
    item(index: number): Element | null;

    [index:number]:Element
}

declare interface HTMLCollection extends HTMLCollectionBase {
    /**
     * Retrieves a select object or an object from an options collection.
     */
    namedItem(name: string): Element | null;
}

declare interface ParentNode extends Node {
    const childElementCount: number;
    /**
     * Returns the child elements.
     */
    const children: HTMLCollection;
    /**
     * Returns the first child that is an element, and null otherwise.
     */
    const firstElementChild: Element | null;
    /**
     * Returns the last child that is an element, and null otherwise.
     */
    const lastElementChild: Element | null;
    /**
     * Inserts nodes after the last child of node, while replacing strings in nodes with equivalent Text nodes.
     *
     * Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.
     */
    append(...nodes: (Node | string)[]): void;
    /**
     * Inserts nodes before the first child of node, while replacing strings in nodes with equivalent Text nodes.
     *
     * Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.
     */
    prepend(...nodes: (Node | string)[]): void;
    /**
     * Returns the first element that is a descendant of node that matches selectors.
     */
    querySelector<E=Element>(selectors: string): E | null;
    /**
     * Returns all element descendants of node that match selectors.
     */
 
    querySelectorAll<E = Element>(selectors: string): NodeListOf<E>;
    /**
     * Replace all children of node with nodes, while replacing strings in nodes with equivalent Text nodes.
     *
     * Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.
     */
    replaceChildren(...nodes: (Node | string)[]): void;
}

declare interface HTMLElement extends Element {
   
    const accessKeyLabel: string;
    const offsetHeight: number;
    const offsetLeft: number;
    const offsetParent: Element | null;
    const offsetTop: number;
    const offsetWidth: number;
    
    accessKey: string;
    autocapitalize: string;
    dir: string;
    draggable: boolean;
    hidden: boolean;
    innerText: string;
    lang: string;
    outerText: string;
    spellcheck: boolean;
    title: string;
    translate: boolean;
    click(): void;
}


declare interface ChildNode extends Node {
    /**
     * Inserts nodes just after node, while replacing strings in nodes with equivalent Text nodes.
     *
     * Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.
     */
    after(...nodes: (Node | string)[]): void;
    /**
     * Inserts nodes just before node, while replacing strings in nodes with equivalent Text nodes.
     *
     * Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.
     */
    before(...nodes: (Node | string)[]): void;
    /**
     * Removes node.
     */
    remove(): void;
    /**
     * Replaces node with nodes, while replacing strings in nodes with equivalent Text nodes.
     *
     * Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.
     */
    replaceWith(...nodes: (Node | string)[]): void;
}

/** A DOM element's attribute as an object. In most DOM methods, you will probably directly retrieve the attribute as a string (e.g., Element.getAttribute(), but certain functions (e.g., Element.getAttributeNode()) or means of iterating give Attr types. */
declare interface Attr extends Node {
    get localName(): string;
    get name(): string;
    get namespaceURI(): string | null;
    get ownerElement(): Element | null;
    get prefix(): string | null;
    get specified(): boolean;
    get value():string;
    set value(val:string):void;
}

declare interface NamedNodeMap {
    const length: number;
    getNamedItem(qualifiedName: string): Attr | null;
    getNamedItemNS(namespace: string | null, localName: string): Attr | null;
    item(index: number): Attr | null;
    removeNamedItem(qualifiedName: string): Attr;
    removeNamedItemNS(namespace: string | null, localName: string): Attr;
    setNamedItem(attr: Attr): Attr | null;
    setNamedItemNS(attr: Attr): Attr | null;
}


/** A set of space-separated tokens. Such a set is returned by Element.classList, HTMLLinkElement.relList, HTMLAnchorElement.relList, HTMLAreaElement.relList, HTMLIframeElement.sandbox, or HTMLOutputElement.htmlFor. It is indexed beginning with 0 as with JavaScript Array objects. DOMTokenList is always case-sensitive. */
declare interface DOMTokenList {
    /**
     * Returns the number of tokens.
     */
    const length: number;
    /**
     * Returns the associated set as string.
     *
     * Can be set, to change the associated attribute.
     */
    var value: string;
    toString(): string;
    /**
     * Adds all arguments passed, except those already present.
     *
     * Throws a "SyntaxError" DOMException if one of the arguments is the empty string.
     *
     * Throws an "InvalidCharacterError" DOMException if one of the arguments contains any ASCII whitespace.
     */
    add(...tokens: string[]): void;
    /**
     * Returns true if token is present, and false otherwise.
     */
    contains(token: string): boolean;
    /**
     * Returns the token with index index.
     */
    item(index: number): string | null;
    /**
     * Removes arguments passed, if they are present.
     *
     * Throws a "SyntaxError" DOMException if one of the arguments is the empty string.
     *
     * Throws an "InvalidCharacterError" DOMException if one of the arguments contains any ASCII whitespace.
     */
    remove(...tokens: string[]): void;
    /**
     * Replaces token with newToken.
     *
     * Returns true if token was replaced with newToken, and false otherwise.
     *
     * Throws a "SyntaxError" DOMException if one of the arguments is the empty string.
     *
     * Throws an "InvalidCharacterError" DOMException if one of the arguments contains any ASCII whitespace.
     */
    replace(token: string, newToken: string): boolean;
    /**
     * Returns true if token is in the associated attribute's supported tokens. Returns false otherwise.
     *
     * Throws a TypeError if the associated attribute has no supported tokens defined.
     */
    supports(token: string): boolean;
    /**
     * If force is not given, "toggles" token, removing it if it's present and adding it if it's not present. If force is true, adds token (same as add()). If force is false, removes token (same as remove()).
     *
     * Returns true if token is now present, and false otherwise.
     *
     * Throws a "SyntaxError" DOMException if token is empty.
     *
     * Throws an "InvalidCharacterError" DOMException if token contains any spaces.
     */
    toggle(token: string, force?: boolean): boolean;
    forEach(callbackfn: (value: string, key: number, parent: DOMTokenList) => void, thisArg?: any): void;
}

declare type ShadowRootMode = "closed" | "open";

declare interface ShadowRoot {
    const delegatesFocus: boolean;
    const host: Element;
    const mode: ShadowRootMode;
}

declare type SlotAssignmentMode = "manual" | "named";

declare interface ShadowRootInit {
    var delegatesFocus?: boolean;
    var mode: ShadowRootMode;
    var slotAssignment?: SlotAssignmentMode;
}


declare interface DOMRectReadOnly {
    const bottom: number;
    const height: number;
    const left: number;
    const right: number;
    const top: number;
    const width: number;
    const x: number;
    const y: number;
    toJSON(): any;
}

declare interface DOMRect extends DOMRectReadOnly {
   var height: number;
   var width: number;
    var x: number;
    var y: number;
    fromRect(other?: DOMRect): DOMRect;
}

declare interface DOMRectList {
    const length: number;
    item(index: number): DOMRect | null;
}

declare interface HTMLCollectionOf<T extends Element> extends HTMLCollectionBase {
    namedItem(name: string): T | null;
}
declare type FullscreenNavigationUI = "auto" | "hide" | "show";
declare interface FullscreenOptions {
    var navigationUI?: FullscreenNavigationUI;
}

declare type InsertPosition = "beforebegin" | "afterbegin" | "beforeend" | "afterend";
declare type ScrollLogicalPosition = "center" | "end" | "nearest" | "start";
declare type ScrollBehavior = "auto" | "smooth";

declare interface ScrollIntoViewOptions extends ScrollOptions {
    var block?: ScrollLogicalPosition;
    var inline?: ScrollLogicalPosition;
}

declare interface ScrollOptions {
    var behavior?: ScrollBehavior;
}

declare interface ScrollToOptions extends ScrollOptions {
    var left?: number;
    var top?: number;
}

/** Element is the most general base class from which all objects in a Document inherit. It only has methods and properties common to all kinds of elements. More specific classes inherit from Element. */
declare interface Element extends Node {
    const attributes: NamedNodeMap;
    /**
     * Allows for manipulation of element's class content attribute as a set of whitespace-separated tokens through a DOMTokenList object.
     */
    const classList: DOMTokenList;
    /**
     * Returns the value of element's class content attribute. Can be set to change it.
     */
    var className: string;
    const clientHeight: number;
    const clientLeft: number;
    const clientTop: number;
    const clientWidth: number;
    /**
     * Returns the value of element's id content attribute. Can be set to change it.
     */
    var id: string;
    /**
     * Returns the local name.
     */
    const localName: string;
    /**
     * Returns the namespace.
     */
    const namespaceURI: string | null;
    const onfullscreenchange: (ev: Event) => any;
    const onfullscreenerror: (ev: Event) => any;
    const outerHTML: string;
    const ownerDocument: Document;
    const part: DOMTokenList;
    /**
     * Returns the namespace prefix.
     */
    const prefix: string | null;
    const scrollHeight: number;
    var scrollLeft: number;
    var scrollTop: number;
    const scrollWidth: number;
    /**
     * Returns element's shadow root, if any, and if shadow root's mode is "open", and null otherwise.
     */
    const shadowRoot: ShadowRoot | null;
    /**
     * Returns the value of element's slot content attribute. Can be set to change it.
     */
    var slot: string;
    /**
     * Returns the HTML-uppercased qualified name.
     */
    const tagName: string;
    /**
     * Creates a shadow root for element and returns it.
     */
    attachShadow(init: ShadowRootInit): ShadowRoot;
    /**
     * Returns the first (starting at element) inclusive ancestor that matches selectors, and null otherwise.
     */
    closest<K>(selector: K): any;
    /**
     * Returns element's first attribute whose qualified name is qualifiedName, and null if there is no such attribute otherwise.
     */
    getAttribute(qualifiedName: string): string | null;
    /**
     * Returns element's attribute whose namespace is namespace and local name is localName, and null if there is no such attribute otherwise.
     */
    getAttributeNS(namespace: string | null, localName: string): string | null;
    /**
     * Returns the qualified names of all element's attributes. Can contain duplicates.
     */
    getAttributeNames(): string[];
    getAttributeNode(qualifiedName: string): Attr | null;
    getAttributeNodeNS(namespace: string | null, localName: string): Attr | null;
    getBoundingClientRect(): DOMRect;
    getClientRects(): DOMRectList;
    /**
     * Returns a HTMLCollection of the elements in the object on which the method was invoked (a document or an element) that have all the classes given by classNames. The classNames argument is interpreted as a space-separated list of classes.
     */
    getElementsByClassName(classNames: string): HTMLCollectionOf<Element>;
    getElementsByTagName<K>(qualifiedName: K): HTMLCollectionOf<Element>;
    getElementsByTagNameNS(namespace: string | null, localName: string): HTMLCollectionOf<Element>;
    /**
     * Returns true if element has an attribute whose qualified name is qualifiedName, and false otherwise.
     */
    hasAttribute(qualifiedName: string): boolean;
    /**
     * Returns true if element has an attribute whose namespace is namespace and local name is localName.
     */
    hasAttributeNS(namespace: string | null, localName: string): boolean;
    /**
     * Returns true if element has attributes, and false otherwise.
     */
    hasAttributes(): boolean;
    hasPointerCapture(pointerId: number): boolean;
    insertAdjacentElement(where: InsertPosition, element: Element): Element | null;
    insertAdjacentHTML(position: InsertPosition, text: string): void;
    insertAdjacentText(where: InsertPosition, data: string): void;
    /**
     * Returns true if matching selectors against element's root yields element, and false otherwise.
     */
    matches(selectors: string): boolean;
    releasePointerCapture(pointerId: number): void;
    /**
     * Removes element's first attribute whose qualified name is qualifiedName.
     */
    removeAttribute(qualifiedName: string): void;
    /**
     * Removes element's attribute whose namespace is namespace and local name is localName.
     */
    removeAttributeNS(namespace: string | null, localName: string): void;
    removeAttributeNode(attr: Attr): Attr;
    /**
     * Displays element fullscreen and resolves promise when done.
     *
     * When supplied, options's navigationUI member indicates whether showing navigation UI while in fullscreen is preferred or not. If set to "show", navigation simplicity is preferred over screen space, and if set to "hide", more screen space is preferred. User agents are always free to honor user preference over the application's. The default value "auto" indicates no application preference.
     */
    requestFullscreen(options?: FullscreenOptions): Promise<void>;
    requestPointerLock(): void;
    scroll(x: number, y: number): void;
    scrollBy(x: number, y: number): void;
    scrollIntoView(arg?: boolean | ScrollIntoViewOptions): void;
    scrollTo(x: number, y: number): void;
    /**
     * Sets the value of element's first attribute whose qualified name is qualifiedName to value.
     */
    setAttribute(qualifiedName: string, value: string): void;
    /**
     * Sets the value of element's attribute whose namespace is namespace and local name is localName to value.
     */
    setAttributeNS(namespace: string | null, qualifiedName: string, value: string): void;
    setAttributeNode(attr: Attr): Attr | null;
    setAttributeNodeNS(attr: Attr): Attr | null;
    setPointerCapture(pointerId: number): void;
    /**
     * If force is not given, "toggles" qualifiedName, removing it if it is present and adding it if it is not present. If force is true, adds qualifiedName. If force is false, removes qualifiedName.
     *
     * Returns true if qualifiedName is now present, and false otherwise.
     */
    toggleAttribute(qualifiedName: string, force?: boolean): boolean;
    /** @deprecated This is a legacy alias of `matches`. */
    webkitMatchesSelector(selectors: string): boolean;
}


/** The location (URL) of the object it is linked to. Changes done on it are reflected on the object it relates to. Both the Document and Window interface have such a linked Location, accessible via Document.location and Window.location respectively. */
declare interface Location {
    /**
     * Returns a DOMStringList object listing the origins of the ancestor browsing contexts, from the parent browsing context to the top-level browsing context.
     */
    const ancestorOrigins: any;
    /**
     * Returns the Location object's URL's fragment (includes leading "#" if non-empty).
     *
     * Can be set, to navigate to the same URL with a changed fragment (ignores leading "#").
     */
    var hash: string;
    /**
     * Returns the Location object's URL's host and port (if different from the default port for the scheme).
     *
     * Can be set, to navigate to the same URL with a changed host and port.
     */
    var host: string;
    /**
     * Returns the Location object's URL's host.
     *
     * Can be set, to navigate to the same URL with a changed host.
     */
    var hostname: string;
    /**
     * Returns the Location object's URL.
     *
     * Can be set, to navigate to the given URL.
     */
    var href: string;
    /**
     * Returns the Location object's URL's origin.
     */
    const origin: string;
    /**
     * Returns the Location object's URL's path.
     *
     * Can be set, to navigate to the same URL with a changed path.
     */
    var pathname: string;
    /**
     * Returns the Location object's URL's port.
     *
     * Can be set, to navigate to the same URL with a changed port.
     */
    var port: string;
    /**
     * Returns the Location object's URL's scheme.
     *
     * Can be set, to navigate to the same URL with a changed scheme.
     */
    var protocol: string;
    /**
     * Returns the Location object's URL's query (includes leading "?" if non-empty).
     *
     * Can be set, to navigate to the same URL with a changed query (ignores leading "?").
     */
    var search: string;
    /**
     * Navigates to the given URL.
     */
    assign(url: string): void;
    /**
     * Reloads the current page.
     */
    reload(): void;
    /**
     * Removes the current page from the session history and navigates to the given URL.
     */
    replace(url: string): void;
    toString(): string;
}

declare const location:Location;


/** An event which takes place in the DOM. */
declare class Event extends Object{
    /**
     * Returns true or false depending on how event was initialized. True if event goes through its target's ancestors in reverse tree order, and false otherwise.
     */
    const bubbles:boolean;
    /**
     * Returns true or false depending on how event was initialized. Its return value does not always carry meaning, but true can indicate that part of the operation during which event was dispatched, can be canceled by invoking the preventDefault() method.
     */
    const cancelable:boolean;
    /**
     * Returns true or false depending on how event was initialized. True if event invokes listeners past a ShadowRoot node that is the root of its target, and false otherwise.
     */
    const composed: boolean;
    /**
     * Returns the object whose event listener's callback is currently being invoked.
     */
    const currentTarget: IEventDispatcher | null;
    /**
     * Returns true if preventDefault() was invoked successfully to indicate cancelation, and false otherwise.
     */
    const defaultPrevented: boolean;
    /**
     * Returns the event's phase, which is one of NONE, CAPTURING_PHASE, AT_TARGET, and BUBBLING_PHASE.
     */
    const eventPhase: number;
    /**
     * Returns true if event was dispatched by the user agent, and false otherwise.
     */
    const isTrusted: boolean;
    var returnValue: boolean;
   
    /**
     * Returns the object to which event is dispatched (its target).
     */
    const target: IEventDispatcher | null;
    /**
     * Returns the event's timestamp as the number of milliseconds measured relative to the time origin.
     */
    const timeStamp: number;
    /**
     * Returns the type of event, e.g. "click", "hashchange", or "submit".
     */
    const type: string;
    
    /**
     * If invoked when the cancelable attribute value is true, and while executing a listener for the event with passive set to false, signals to the operation that caused event to be dispatched that it needs to be canceled.
     */
    preventDefault(): void;
    /**
     * Invoking this method prevents event from reaching any registered event listeners after the current one finishes running and, when dispatched in a tree, also prevents event from reaching any other objects.
     */
    stopImmediatePropagation(): void;
    /**
     * When dispatched in a tree, invoking this method prevents event from reaching any objects other than the current object.
     */
    stopPropagation(): void;

    constructor(type:string, bubbles?:boolean,cancelable?:boolean);

    [key:string]:any
}


/** EventTarget is a DOM interface implemented by objects that can receive events and may have listeners for them. */
declare interface IEventDispatcher {
    /**
     * Appends an event listener for events whose type attribute value is type. 
     * The callback argument sets the callback that will be invoked when the event is dispatched.
     */
    addEventListener(type: string, listener: (event?:Event)=>void ): this;
    /**
     * Dispatches a synthetic event event to target and returns true 
     * if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
     */
    dispatchEvent(event: Event): boolean;
    /**
     * Removes the event listener in target's event listener list with the same type, callback, and options.
     */
    removeEventListener(type: string, listener?: (event?:Event)=>void ): boolean;

    /**
    * Checks whether a listener of the specified type has been added
    */
    hasEventListener(type: string, listener?: (event?:Event)=>void):boolean;
}

/** EventTarget is a DOM interface implemented by objects that can receive events and may have listeners for them. */
declare class EventDispatcher implements IEventDispatcher{
    constructor(target?:object);
}


/** Simple user interface events. */
declare class UIEvent extends Event {
    const detail: number;
    const view: Window | null;
    constructor(type:string, bubbles?:boolean,cancelable?:boolean);
}

/** Events that occur due to the user interacting with a pointing device (such as a mouse). Common events using this interface include click, dblclick, mouseup, mousedown. */
declare class MouseEvent extends UIEvent {

    static const MOUSE_DOWN:string='mousedown';
    static const MOUSE_UP:string='mouseup';
    static const MOUSE_OVER:string='mouseover';
    static const MOUSE_OUT:string='mouseout';
    static const MOUSE_OUTSIDE:string='mouseoutside';
    static const MOUSE_MOVE:string='mousemove';
    static const MOUSE_WHEEL:string='mousewheel';
    static const CLICK:string='click';
    static const DBLCLICK:string='dblclick';

    const altKey: boolean;
    const wheelDelta: number;
    const button: number;
    const buttons: number;
    const clientX: number;
    const clientY: number;
    const ctrlKey: boolean;
    const metaKey: boolean;
    const movementX: number;
    const movementY: number;
    const offsetX: number;
    const offsetY: number;
    const pageX: number;
    const pageY: number;
    const relatedTarget: EventDispatcher | null;
    const screenX: number;
    const screenY: number;
    const shiftKey: boolean;
    const x: number;
    const y: number;

    constructor(type:string, bubbles?:boolean,cancelable?:boolean);
    getModifierState(keyArg: string): boolean;
    initMouseEvent(typeArg: string, 
                    canBubbleArg: boolean, 
                    cancelableArg: boolean, 
                    viewArg: Window, 
                    detailArg: number, 
                    screenXArg: number, 
                    screenYArg: number, 
                    clientXArg: number, 
                    clientYArg: number, 
                    ctrlKeyArg: boolean, 
                    altKeyArg: boolean, 
                    shiftKeyArg: boolean, 
                    metaKeyArg: boolean, 
                    buttonArg: number, 
                    relatedTargetArg: EventDispatcher | null): void; 
}

/** 
* KeyboardEvent objects describe a user interaction with the keyboard; 
* each event describes a single interaction between the user and a key (or combination of a key with modifier keys) 
* on the keyboard. 
*/
declare class KeyboardEvent extends UIEvent{
    const altKey: boolean;
    const code: string;
    const ctrlKey: boolean;
    const isComposing: boolean;
    const key: string;
    const location: number;
    const metaKey: boolean;
    const repeat: boolean;
    const shiftKey: boolean;
    const DOM_KEY_LOCATION_LEFT: number;
    const DOM_KEY_LOCATION_NUMPAD: number;
    const DOM_KEY_LOCATION_RIGHT: number;
    const DOM_KEY_LOCATION_STANDARD: number;
    constructor(type:string, bubbles?:boolean,cancelable?:boolean);
    getModifierState(keyArg: string): boolean;
}

declare type TouchType =  "direct" | "stylus";

declare class Touch extends Object{
    const altitudeAngle: number;
    const azimuthAngle: number;
    const clientX: number;
    const clientY: number;
    const force: number;
    const identifier: number;
    const pageX: number;
    const pageY: number;
    const radiusX: number;
    const radiusY: number;
    const rotationAngle: number;
    const screenX: number;
    const screenY: number;
    const target: EventDispatcher;
    const touchType: TouchType;
}

declare interface TouchList {
    const length: number;
    item(index: number):Touch;
}

declare class TouchEvent extends UIEvent {
    const altKey: boolean;
    const changedTouches: TouchList;
    const ctrlKey: boolean;
    const metaKey: boolean;
    const shiftKey: boolean;
    const targetTouches: TouchList;
    const touches: TouchList;
    constructor(type:string, bubbles?:boolean,cancelable?:boolean);
}

declare interface DataTransfer extends Object{}

/** A DOM event that represents a drag and drop interaction. 
The user initiates a drag by placing a pointer device (such as a mouse) on the touch surface and then dragging 
the pointer to a new location (such as another DOM element). Applications are free to interpret a drag and 
drop interaction in an application-specific way.
 */
declare class DragEvent extends MouseEvent {
    /**
     * Returns the DataTransfer object for the event.
     */
    const dataTransfer: DataTransfer | null;

    constructor(type:string, bubbles?:boolean,cancelable?:boolean);
}

declare type TestAlisType = string | number | null;

declare type AddressReferenceType<T9666> = T9666;

declare type OType<T06933>= {
    name:T06933,
};

declare type Objecter<T> = T;


declare interface ArrayMappingType<T> extends Array<T>{
    [key:string]:T
}

//引用内存地址类型
declare type RMD<T> = T;



declare class Override{

    add(name:'person'):string[];
    add(name:'person', age:int):{name:string,age:int}[]
    add(name:'name', age:int):number

    push<T>(item:T, num:number):T;
    push<T>(item:T, num:number, flag:boolean):T[];
    push(item:string):string;

    get name():string
    set name(name:string):void;

}

declare function testOveride<T>(name:T, age:int):boolean;
declare function testOveride(name:string):string;
declare function testOveride(name:string, age:int):{name:string,age:number};
declare function testOveride(name:1):1;
declare function testOveride(name:'string123'):'string123';


 declare interface ChooseImageSuccessCallbackResult {
        /**
         * 图片的本地文件路径列表
         */
        tempFilePaths: string | string [];
        /**
         * 图片的本地文件列表，每一项是一个 File 对象
         */
        tempFiles: string[];
    }

declare interface RequestOptions{
    success?:(res:ChooseImageSuccessCallbackResult)=>void;
    fail?(res:Error):void
    header?:{
        contentType:(res:string)=>void
    }
}


declare type AsyncRequestOptions<O,S,F> = O & {success:(result:S)=>void} | {fail:(result:F)=>void}


declare module web.Application {


    declare class Application{

    }

    declare const name:string;

    export default name;

}





declare class Proxy{
    static revocable<T extends object>(target: T, handler: ProxyHandler<T>): { proxy: T, revoke: () => void};
    constructor<T extends object>(target:T, handler:ProxyHandler<T>):T;
}

declare interface ProxyHandler<T extends object> {
    apply?(target: T, thisArg: any, argArray: any[]): any;
    construct?(target: T, argArray: any[], newTarget: Function): object;
    defineProperty?(target: T, p: string, attributes: PropertyDescriptor): boolean;
    deleteProperty?(target: T, p: string): boolean;
    get?(target: T, p: string, receiver: any): any;
    getOwnPropertyDescriptor?(target: T, p: string): PropertyDescriptor;
    getPrototypeOf?(target: T): object | null;
    has?(target: T, p: string): boolean;
    isExtensible?(target: T): boolean;
    ownKeys?(target: T): ArrayLike<string>;
    preventExtensions?(target: T): boolean;
    set?(target: T, p: string, value: any, receiver: any): boolean;
    setPrototypeOf?(target: T, v: object | null): boolean;
}

declare interface PropertyDescriptor {
    configurable?: boolean;
    enumerable?: boolean;
    value?: any;
    writable?: boolean;
    get?(): any;
    set?(v: any): void;
}

declare interface CallMethod<B>{
    <T=any>(name:T):object
    <T extends string>(name:T):object;
    new<T>(name:T):Object
    new(name):object
    new(name:B, arg:number):boolean
    (name:B, arg:number):boolean
}

declare const callmethod = CallMethod;
declare const callmethod2:CallMethod<string>;