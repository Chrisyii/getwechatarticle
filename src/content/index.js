import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

console.log('WeChat Markdown Exporter Content Script Loaded');

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

turndownService.use(gfm);

// Custom rules for WeChat specific elements if needed
turndownService.addRule('wechat-code', {
    filter: function (node) {
        return node.nodeName === 'PRE' && node.classList.contains('code-snippet__js');
    },
    replacement: function (content, node) {
        return '```\n' + content + '\n```';
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_CONTENT') {
        try {
            // --- Pre-processing: Visual Style Detection ---
            // We must do this on the LIVE DOM before cloning, because getComputedStyle requires a rendered document.
            // We look for headers (h1-h6) that look like body text (similar font size).
            try {
                const contentBox = document.querySelector('#js_content');
                if (contentBox) {
                    // 1. Determine "Body Text" Font Size
                    // We try to find a standard paragraph to measure.
                    const sampleP = contentBox.querySelector('p');
                    let bodyFontSize = 16; // Default fallback (px)
                    if (sampleP) {
                        const style = window.getComputedStyle(sampleP);
                        const fontSize = parseFloat(style.fontSize);
                        if (!isNaN(fontSize) && fontSize > 0) {
                            bodyFontSize = fontSize;
                        }
                    }

                    // 2. Check Headers
                    const headers = contentBox.querySelectorAll('h1, h2, h3, h4, h5, h6');
                    headers.forEach(header => {
                        const style = window.getComputedStyle(header);
                        const fontSize = parseFloat(style.fontSize);

                        // If the header's font size is very close to the body text (e.g. within 2px difference),
                        // we consider it a "fake header" used for bolding/spacing, not a semantic section title.
                        // Real headers are usually significantly larger (e.g. 20px+ vs 16px).
                        if (!isNaN(fontSize) && Math.abs(fontSize - bodyFontSize) <= 2) {
                            // Mark it on the LIVE DOM. 
                            // Note: This modifies the user's page slightly (adding an attribute), but it's invisible and harmless.
                            // We will use this attribute in the clone later.
                            header.setAttribute('data-wechat-downgrade-header', 'true');
                        }
                    });
                }
            } catch (e) {
                console.warn('[WeChat Markdown] Visual style detection failed:', e);
            }

            // 1. Clone the document to avoid modifying the actual page during heavy processing
            const documentClone = document.cloneNode(true);

            // --- Pre-processing for WeChat ---

            // 1. Fix Lazy-loaded Images
            // WeChat uses 'data-src' for images. We need to set 'src' to 'data-src'
            const images = documentClone.querySelectorAll('img');
            images.forEach(img => {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
                // Remove styling that might hide the image or make it look weird in MD
                img.removeAttribute('style');
                img.removeAttribute('class');
            });

            // 2. Handle Code Blocks
            // WeChat code blocks often use non-standard HTML or <br> for newlines.
            // We normalize them to <pre><code>...</code></pre> for Turndown.

            const codeSelectors = ['.code-snippet__fix', '.code-snippet', 'pre'];
            // Use a Set to avoid duplicates if an element matches multiple selectors
            const potentialBlocks = documentClone.querySelectorAll(codeSelectors.join(','));

            // Filter to get only top-level blocks among the matches to avoid double processing
            const topLevelBlocks = Array.from(potentialBlocks).filter(block => {
                let parent = block.parentElement;
                while (parent) {
                    if (parent.matches && parent.matches(codeSelectors.join(','))) {
                        return false; // It's a child of another code block
                    }
                    parent = parent.parentElement;
                }
                return true;
            });

            topLevelBlocks.forEach(block => {
                // 1. Preserve newlines: Replace <br> with \n
                // We use a clone to avoid modifying the DOM before we are done traversing
                const temp = block.cloneNode(true);
                const brs = temp.querySelectorAll('br');
                brs.forEach(br => br.replaceWith('\n'));

                // 2. Get text content
                // We use textContent which gets raw text. 
                // Since we replaced <br> with \n nodes, textContent will include them.
                const codeContent = temp.textContent;

                // 3. Create standard <pre><code>
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = codeContent; // textContent escapes html automatically
                pre.appendChild(code);

                // 4. Replace original
                block.replaceWith(pre);
            });

            // 3. Remove Noise
            const noiseSelectors = [
                '#js_pc_qr_code', // PC QR code
                '.rich_media_area_extra', // Bottom extra area
                '#js_tags', // Tags
                '#js_view_source', // "Read more" link
                '.reward_area', // Reward
                '.like_comment_primary_inner', // Like/Comment
                '.mp_profile_iframe', // Profile iframe
                'mp-common-profile', // Profile component
                'mp-miniprogram', // Mini-program card
                '.rich_media_tool', // Bottom toolbar
                '#js_toobar3', // Another bottom toolbar
                '#js_name', // Account name at top (optional, sometimes redundant)
                '.profile_container' // Profile container
            ];
            noiseSelectors.forEach(selector => {
                const elements = documentClone.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            });

            // 4. Heuristic Footer Cleaning (Text-based) & Header Downgrading
            // Look for specific keywords that indicate the start of a footer/promotion section
            // and remove that element and everything following it (if it's near the end).
            const footerKeywords = [
                '相关文章推荐',
                '往期推荐',
                '欢迎加入',
                '关注我们',
                '点击下方卡片',
                '扫描二维码',
                '识别二维码',
                '长按识别'
            ];

            // We iterate through top-level elements of the content area (usually #js_content)
            const contentContainer = documentClone.querySelector('#js_content');
            if (contentContainer) {
                const children = Array.from(contentContainer.children);
                let foundFooter = false;

                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    const text = child.textContent.trim();

                    // --- Header Downgrading Logic (Visual Style Based) ---
                    // Instead of guessing by text length, we use the visual cue marked earlier.
                    // If the element was marked as "looks like paragraph" in the pre-processing step, we downgrade it.
                    if (child.hasAttribute('data-wechat-downgrade-header')) {
                        const p = document.createElement('p');
                        p.innerHTML = child.innerHTML;
                        child.replaceWith(p);
                        children[i] = p;
                    }

                    // --- Heuristic Footer Cleaning Logic ---
                    // Check if this element contains any of the footer keywords
                    if (!foundFooter) {
                        for (const keyword of footerKeywords) {
                            if (text.includes(keyword)) {
                                // Additional check: usually these are short headers or short paragraphs
                                // If the paragraph is very long (e.g. > 100 chars) and contains the keyword in the middle,
                                // it might be a false positive.
                                if (text.length < 50 || text.startsWith(keyword)) {
                                    foundFooter = true;

                                    // Smart Backtracking: Check previous sibling for index (e.g., "04")
                                    // If the previous element is very short and looks like an index, remove it too.
                                    if (i > 0) {
                                        const prevChild = children[i - 1];
                                        const prevText = prevChild.textContent.trim();
                                        // Check for short digits or "04" style indices
                                        if (prevText.length < 5 && /^\d+$/.test(prevText)) {
                                            prevChild.remove();
                                        }
                                    }

                                    break;
                                }
                            }
                        }
                    }

                    if (foundFooter) {
                        child.remove();
                    }
                }
            }

            // --- End Pre-processing ---

            // Use Readability to parse the article
            const reader = new Readability(documentClone);
            const article = reader.parse();

            if (!article) {
                sendResponse({ error: '无法解析文章内容' });
                return true;
            }

            // Convert HTML to Markdown
            const markdown = turndownService.turndown(article.content);

            // Add title and metadata
            const finalMarkdown = `# ${article.title}\n\n${article.byline ? `**作者:** ${article.byline}\n\n` : ''}${markdown}`;

            sendResponse({
                title: article.title,
                markdown: finalMarkdown
            });
        } catch (error) {
            console.error('Extraction error:', error);
            sendResponse({ error: error.message });
        }
    }
    return true; // Keep the message channel open for async response
});
