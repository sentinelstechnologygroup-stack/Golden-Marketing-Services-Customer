const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('token');
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		token: !isNode ? window.localStorage.getItem('token') : null,
		apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
	}
}


export const appParams = {
	...getAppParams()
}
