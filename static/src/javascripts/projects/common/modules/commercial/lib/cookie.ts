/**
 * WARNING!
 * Commercial client side code has moved to: https://github.com/guardian/commercial
 * This file should be considered deprecated
 */

import { getCookie } from '@guardian/libs';

const timeInDaysFromNow = (daysFromNow: number): string => {
	const tmpDate = new Date();
	tmpDate.setDate(tmpDate.getDate() + daysFromNow);
	return tmpDate.getTime().toString();
};

console.log('Test in FRONTEND- ');
const cookieIsExpiredOrMissing = (cookieName: string): boolean => {
	const expiryDateFromCookie = getCookie({ name: cookieName });
	if (!expiryDateFromCookie) return true;
	const expiryTime = parseInt(expiryDateFromCookie, 10);
	const timeNow = new Date().getTime();
	return timeNow >= expiryTime;
};

export { timeInDaysFromNow, cookieIsExpiredOrMissing };
