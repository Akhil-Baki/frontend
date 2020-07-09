// @flow

import { getBodyEnd, getViewLog, getWeeklyArticleHistory } from '@guardian/automat-client';
import { getSync as geolocationGetSync } from 'lib/geolocation';
import {
    setupOphanView,
    emitBeginEvent,
    setupClickHandling,
    makeEvent, submitOphanInsert,
} from 'common/modules/commercial/contributions-utilities';
import reportError from 'lib/report-error';
import fastdom from 'lib/fastdom-promise';
import config from 'lib/config';
import { getMvtValue } from 'common/modules/analytics/mvt-cookie';
import { submitClickEvent } from 'common/modules/commercial/acquisitions-ophan';
import fetchJson from 'lib/fetch-json';
import { render } from 'preact';
import React from 'preact/compat';
/* eslint-disable import/no-namespace */
import * as emotionCore from "@emotion/core";
import createCache from '@emotion/cache'
import * as emotionTheming from "emotion-theming";
import * as emotion from "emotion";
/* eslint-enable import/no-namespace */


import {
    getLastOneOffContributionDate,
    isRecurringContributor,
    shouldNotBeShownSupportMessaging,
} from 'common/modules/commercial/user-features';

type ServiceModule = {
    url: string,
    props: {}
};

const buildKeywordTags = page => {
    const keywordIds = page.keywordIds.split(',');
    const keywords = page.keywords.split(',');
    return keywordIds.map((id, idx) => ({
        id,
        type: 'Keyword',
        title: keywords[idx],
    }));
};

interface AutomatJsCallback {
    buttonCopyAsString: string;
}

const onReminderOpen = (callbackParams: AutomatJsCallback) => {
    const { buttonCopyAsString } = callbackParams;
    submitClickEvent({
        component: {
            componentType: 'ACQUISITIONS_OTHER',
            id: 'precontribution-reminder-prompt-clicked',
        },
    });
    submitClickEvent({
        component: {
            componentType: 'ACQUISITIONS_OTHER',
            id: `precontribution-reminder-prompt-copy-${buttonCopyAsString}`,
        },
    });
};

const renderEpic = (ContributionsEpic: any, props: any): Promise<HTMLElement> => {
    return fastdom.write(() => {
        const target = document.querySelector(
            '.submeta'
        );

        if (!target) {
            throw new Error(
                'Could not find target element for Epic'
            );
        }

        const parent = target.parentNode;

        if (!parent) {
            throw new Error(
                'Could not find parent element for Epic'
            );
        }

        const container = document.createElement('div');
        parent.insertBefore(container, target);

        // use Shadow Dom if found
        let shadowRoot;
        const useShadowDomIfAvailable = false;
        if (useShadowDomIfAvailable && container.attachShadow) {
            shadowRoot = container.attachShadow({
                mode: 'open',
            });
            const innerContainer = document.createElement('div');
            shadowRoot.appendChild(innerContainer);
            const CacheProvider = emotionCore.CacheProvider;
            const emotionCache = createCache({ container: innerContainer });
            render(<CacheProvider value={emotionCache}><ContributionsEpic {...props} onReminderOpen={onReminderOpen} /></CacheProvider>, innerContainer);
        } else {
            render(<ContributionsEpic {...props} onReminderOpen={onReminderOpen} />, container);
        }

        return container;
    });
};

const buildEpicPayload = () => {
    const ophan = config.get('ophan');
    const page = config.get('page');

    // note, there is a race condition so we want to fetch this as late as possible to give a change for the geo local storage value to be set
    const countryCode = geolocationGetSync();

    const tracking = {
        ophanPageId: ophan.pageViewId,
        ophanComponentId: 'ACQUISITIONS_EPIC',
        platformId: 'GUARDIAN_WEB',
        clientName: 'frontend',
        referrerUrl:
            window.location.origin + window.location.pathname,
    };

    const targeting = {
        contentType: page.contentType,
        sectionName: page.section,
        shouldHideReaderRevenue: page.shouldHideReaderRevenue,
        isMinuteArticle: config.hasTone('Minute'),
        isPaidContent: page.isPaidContent,
        isSensitive: page.isSensitive,
        tags: buildKeywordTags(page),
        showSupportMessaging: !shouldNotBeShownSupportMessaging(),
        isRecurringContributor: isRecurringContributor(),
        lastOneOffContributionDate:
            getLastOneOffContributionDate() || undefined,
        mvtId: getMvtValue(),
        countryCode,
        epicViewLog: getViewLog(),
        weeklyArticleHistory: getWeeklyArticleHistory()
    };

    return {
        tracking,
        targeting,
    };
};

const buildBannerPayload = () => {
    const tracking = {
        // TODO: implement
    };

    const targeting = {
        // TODO: implement
    };

    return {
        tracking,
        targeting,
    };
};

const checkResponseOk = response => {
    if (response.ok) {
        return response;
    }

    throw new Error(
        `Contributions fetch failed with response code: ${response.status}`
    );
};

// TODO: add this to the client library
const getStickyBottomBanner = (payload: {}) => {
    const URL = 'https://contributions.guardianapis.com/banner';
    const json = JSON.stringify(payload);

    return fetchJson(URL, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: json,
    });
};

export const fetchBannerData: () => Promise<?ServiceModule> = () => {
    const payload = buildBannerPayload();

    return getStickyBottomBanner(payload)
        .then(json => {
            if (!json.data) {
                return null;
            }

            const { module } = json.data;

            return module;
        });
};

export const renderBanner: (?ServiceModule) => Promise<boolean> = (module) => {
    if(!module) {
        return Promise.resolve(false);
    }

    window.guardian.automat = {
        react: React,
        emotionCore,
        emotionTheming,
        emotion,
    };

    // $FlowFixMe
    return import(/* webpackIgnore: true */ module.url)
        .then(bannerModule => {
            const Banner = bannerModule.Banner;
            const props = module.props;

            // TODO: tracking

            return fastdom.write(() => {
                const container = document.createElement('div');
                if(document.body) {
                    document.body.insertAdjacentElement('beforeend', container);
                }

                return render(
                    <Banner {...props} />,
                    container
                );
            }).then(() => true);
        })
        .catch(error => {
            console.log(error);
            reportError(error, {}, false);
        });
};

export const fetchAndRenderEpic = (id: string) => {
    const payload = buildEpicPayload();
    const products = ['CONTRIBUTION', 'MEMBERSHIP_SUPPORTER'];
    const componentType = 'ACQUISITIONS_EPIC';
    const viewEvent = makeEvent(id, 'view');

    // TODO: Fix the URL here
    const contributionsServiceUrl = 'http://localhost:8080';
    getBodyEnd(payload, `${contributionsServiceUrl}/epic?dataOnly=true`)
        .then(checkResponseOk)
        .then(response => response.json())
        .then(json => {
            if (!json || !json.data) {
                return;
            }

            const { module, meta } = json.data;

            if (!module) {
                return;
            }

            // TODO: share this between banner and epic?
            window.guardian.automat = {
                react: React,
                emotionCore,
                emotionTheming,
                emotion,
            };

            // $FlowFixMe
            return import(/* webpackIgnore: true */ module.url)
                .then(epicModule => {
                    const trackingCampaignId = `${meta.campaignId}`;

                    emitBeginEvent(trackingCampaignId);
                    // TODO: verify this click handling still works
                    setupClickHandling(meta.abTestName, meta.abTestVariant, componentType, meta.campaignCode, products);

                    return renderEpic(epicModule.ContributionsEpic, module.props)
                        .then(el => {
                            submitOphanInsert(meta.abTestName, meta.abTestVariant, componentType, products, meta.campaignCode)
                            setupOphanView(
                                el,
                                viewEvent,
                                meta.abTestName,
                                meta.abTestVariant,
                                meta.campaignCode,
                                trackingCampaignId,
                                componentType,
                                products,
                                meta.abTestVariant.showTicker,
                                meta.abTestVariant.tickerSettings,
                            )})
                })
        })
        .catch(error => {
            console.log(error);
            reportError(error, {}, false);
        });
};
