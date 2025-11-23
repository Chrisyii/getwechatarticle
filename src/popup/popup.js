document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const statusDiv = document.getElementById('status');

    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 3000);
    }

    async function handleAction(action) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('mp.weixin.qq.com')) {
            showStatus('当前不是微信文章页面', 'error');
            return;
        }

        try {
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });

            if (!response || !response.markdown) {
                throw new Error('提取内容失败');
            }

            if (action === 'copy') {
                await navigator.clipboard.writeText(response.markdown);
                showStatus('已复制到剪贴板！', 'success');
            } else if (action === 'download') {
                const blob = new Blob([response.markdown], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const filename = `${response.title || 'article'}.md`;

                await chrome.downloads.download({
                    url: url,
                    filename: filename,
                    saveAs: true
                });
                showStatus('开始下载！', 'success');
            }
        } catch (error) {
            console.error(error);
            showStatus('错误: ' + error.message, 'error');
        }
    }

    copyBtn.addEventListener('click', () => handleAction('copy'));
    downloadBtn.addEventListener('click', () => handleAction('download'));
});
