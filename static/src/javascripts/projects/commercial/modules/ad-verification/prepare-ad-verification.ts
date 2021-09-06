import { loadScript } from '@guardian/libs';
import config from 'lib/config';

const errorHandler = (error: Error) => {
	// Looks like some plugins block ad-verification
	// Avoid barraging Sentry with errors from these pageviews
	console.log('Failed to load Confiant:', error);
};

export const init = async (): Promise<void> => {
	const host = 'confiant-integrations.global.ssl.fastly.net';

	if (config.get('switches.confiantAdVerification')) {
		await loadScript(
			`//${host}/7oDgiTsq88US4rrBG0_Nxpafkrg/gpt_and_prebid/config.js`,
			{ async: true },
		).catch(errorHandler);
	}

	return;
};
