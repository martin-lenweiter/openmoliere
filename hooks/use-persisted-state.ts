import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";

export function usePersistedState<T>(
	key: string,
	initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
	const [value, setValue] = useState<T>(() => {
		if (typeof window === "undefined") return initialValue;
		try {
			const stored = sessionStorage.getItem(key);
			return stored ? (JSON.parse(stored) as T) : initialValue;
		} catch {
			return initialValue;
		}
	});

	useEffect(() => {
		try {
			sessionStorage.setItem(key, JSON.stringify(value));
		} catch {
			// Storage full or unavailable
		}
	}, [key, value]);

	return [value, setValue];
}
