import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";

export function usePersistedState<T>(
	key: string,
	initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
	const [value, setValue] = useState<T>(initialValue);
	const isFirstRender = useRef(true);

	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			try {
				const stored = sessionStorage.getItem(key);
				if (stored !== null) {
					setValue(JSON.parse(stored) as T);
					return;
				}
			} catch {}
		}
		try {
			sessionStorage.setItem(key, JSON.stringify(value));
		} catch {
			// Storage full or unavailable
		}
	}, [key, value]);

	return [value, setValue];
}
