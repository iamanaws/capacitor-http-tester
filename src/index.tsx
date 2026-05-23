import * as React from "react";
import {createRoot} from "react-dom/client";
import {Capacitor, CapacitorCookies, CapacitorHttp} from "@capacitor/core";

declare global {
    interface Window {
        cordova?: unknown;
    }
}

const BASE_URL =
    Capacitor.getPlatform() == "android"
        ? "http://10.0.2.2:3000"
        : "http://localhost:3000";

const root = createRoot(document.getElementById("root")!);

const makeRandomString = () => (Math.random() + 1).toString(36).substring(2);

const apiUrl = (path: string) => `${BASE_URL}${path}`;
const isNative = Capacitor.isNativePlatform();

const getCookie = async (name: string) => {
    if (!isNative) {
        return document.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith(`${name}=`))
            ?.split("=")[1];
    }

    const cookies = await CapacitorCookies.getCookies({url: BASE_URL});
    return cookies[name];
};

const setCookie = async (name: string, value: string) => {
    if (!isNative) {
        document.cookie = `${name}=${value}; path=/`;
        return;
    }

    await CapacitorCookies.setCookie({
        url: BASE_URL,
        key: name,
        value,
        path: "/",
    });
};

const deleteCookie = async (name: string) => {
    if (!isNative) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
        return;
    }

    await CapacitorCookies.deleteCookie({url: BASE_URL, key: name});
};

const simple = async () => {
    const response = await CapacitorHttp.get({url: apiUrl("/api/simple/")});
    return JSON.stringify(response.data) == '{"thisThing":"Works"}';
};

const requestObject = async () => {
    const response = await CapacitorHttp.request({
        url: apiUrl("/api/simple/"),
        method: "GET",
    });
    return JSON.stringify(response.data) == '{"thisThing":"Works"}';
};
requestObject.issue = "6174";

const serializingHeaders = async () => {
    const response = await CapacitorHttp.get({
        url: apiUrl("/api/headers/"),
        headers: {"X-Some-Header": "Working"},
    });
    const {header} = response.data;
    return header == "Working";
};
serializingHeaders.issue = "5945";

const responseHeaders = async () => {
    const response = await CapacitorHttp.get({url: apiUrl("/api/simple/")});
    return response.headers != null && typeof response.headers == "object";
};

const cookie = async () => {
    const name = makeRandomString();
    const value = makeRandomString();
    await CapacitorHttp.get({url: apiUrl(`/api/cookie/${name}/${value}/`)});
    return (await getCookie(name)) == value;
};

const urlEncoded = async () => {
    const payload = {some: "value"};
    const response = await CapacitorHttp.post({
        url: apiUrl("/api/body/"),
        data: new URLSearchParams(payload).toString(),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });

    return JSON.stringify(response.data) == '{"some":"value"}';
};
urlEncoded.issue = "6165";

const multipartEncoded = async () => {
    const body = new FormData();
    body.append("doesthiswork", "itdoes");
    const response = await fetch(apiUrl("/api/multipart/"), {
        method: "POST",
        body,
    });

    const {result} = await response.json();
    return result == "itdoes";
};
multipartEncoded.issue = "6142";

const readText = async () => {
    const response = await CapacitorHttp.get({
        url: apiUrl("/api/text/"),
        responseType: "text",
    });

    return (
        response.data ==
        "I am text, content type should not take precendece over calling response.text()"
    );
};
readText.issue = "6184";

const numberResponse = async () => {
    const response = await CapacitorHttp.get({url: apiUrl("/api/number/")});
    return response.data == 5;
};
numberResponse.issue = "6170";

const stringResponse = async () => {
    const response = await CapacitorHttp.get({url: apiUrl("/api/string/")});
    return response.data == "a string";
};
stringResponse.issue = "6170";

const nullResponse = async () => {
    const response = await CapacitorHttp.get({url: apiUrl("/api/null/")});
    return response.data == null;
};
nullResponse.issue = "6170";

const trueResponse = async () => {
    const response = await CapacitorHttp.get({url: apiUrl("/api/true/")});
    return response.data == true;
};
trueResponse.issue = "6170";

const falseResponse = async () => {
    const response = await CapacitorHttp.get({url: apiUrl("/api/false/")});
    return response.data == false;
};
falseResponse.issue = "6170";

const readCookieSetOnClient = async () => {
    const cookieName = makeRandomString();
    const cookieValue = makeRandomString();
    await setCookie(cookieName, cookieValue);

    const response = await CapacitorHttp.get({
        url: apiUrl(`/api/read-cookie/${cookieName}`),
    });
    const {value} = response.data;
    return value == cookieValue;
};
readCookieSetOnClient.issue = "6196";

const deleteServerSetCookie = async () => {
    const cookieName = makeRandomString();
    const cookieValue = makeRandomString();

    await CapacitorHttp.get({url: apiUrl(`/api/cookie/${cookieName}/${cookieValue}`)});
    await deleteCookie(cookieName);
    const response = await CapacitorHttp.get({
        url: apiUrl(`/api/read-cookie/${cookieName}`),
    });
    const {value} = response.data;
    return value == null;
};
deleteServerSetCookie.issue = "6197";

const readBlob = async () => {
    const response = await fetch(apiUrl("/api/blob/"));
    const {size} = await response.blob();
    return size == 33788;
};
readBlob.issue = "6126";

const badRequest = async () => {
    const response = await CapacitorHttp.get({url: apiUrl("/api/400/")});
    const {thisField} = response.data;
    return response.status == 400 && thisField == "is required";
};

const networkError = async () => {
    try {
        await CapacitorHttp.get({url: "https://nowaythisworks"});
        return false;
    } catch (error: unknown) {
        return true;
    }
};

interface TestCase {
    (): Promise<boolean>;
    issue?: string;
}

const Test = (props: {name: string; test: TestCase}) => {
    const [passed, setPassed] = React.useState<boolean | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        props
            .test()
            .then((passed) => {
                setPassed(passed);
            })
            .catch((error: unknown) => {
                setError(error instanceof Error ? error.message : String(error));
                setPassed(false);
            });
    }, []);

    return (
        <div style={{lineHeight: 1}}>
            <h3 style={{marginTop: 0, marginBottom: 0}}>
                {props.name}{" "}
                {props.test.issue != null && (
                    <a
                        href={`https://github.com/ionic-team/capacitor/issues/${props.test.issue}/`}
                    >
                        #{props.test.issue}
                    </a>
                )}
            </h3>
            {passed == null && (
                <h5 style={{marginTop: 0, marginBottom: 0, color: "gray"}}>Running</h5>
            )}
            {passed == true && (
                <h5 style={{marginTop: 0, marginBottom: 0, color: "green"}}>Passed</h5>
            )}
            {passed == false && (
                <h5 style={{marginTop: 0, marginBottom: 0, color: "red"}}>Failed</h5>
            )}
            {error != null && (
                <pre style={{marginTop: 0, color: "crimson", whiteSpace: "pre-wrap"}}>
                    {error}
                </pre>
            )}
        </div>
    );
};

const Tests = (props: {tests: Record<string, TestCase>}) => {
    return (
        <div>
            {Object.entries(props.tests).map(([name, test]) => {
                return <Test key={name} name={name} test={test} />;
            })}
        </div>
    );
};

root.render(
    <div>
        <Tests
            tests={{
                simple,
                requestObject,
                serializingHeaders,
                responseHeaders,
                cookie,
                urlEncoded,
                multipartEncoded,
                readText,
                numberResponse,
                stringResponse,
                nullResponse,
                trueResponse,
                falseResponse,
                readCookieSetOnClient,
                deleteServerSetCookie,
                readBlob,
                badRequest,
                networkError,
            }}
        />
    </div>,
);
