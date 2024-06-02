document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('.form-submit');
    const coverList = document.getElementById('cover-list');
    const coverSelected = document.getElementById('cover-selected');
    let imagePaths = []; // 用于保存图像地址的数组

    const getImages = () => {
        if (imagePaths.length === 0) { // 只有当 imagePaths 数组为空时，才向服务器发出请求
            fetch('http://localhost:3000/get-images')
                .then(response => response.json())
                .then(data => {
                    if (data.imagePaths && data.imagePaths.length > 0) {
                        imagePaths = data.imagePaths; // 将接收到的图像地址添加到 imagePaths 数组中
                        displayImages();
                        coverList.style.display = '';
                        coverList.classList.add('show');
                    } else {
                        // 请求成功但没有图片，显示文本框和提交按钮
                        coverList.style.display = 'none';
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    // 请求失败，显示文本框和提交按钮
                    coverList.style.display = 'none';
                });
        }
    };

    const displayImages = () => {
        if (imagePaths.length > 0) {
            imagePaths.forEach((path, index) => { // 遍历 imagePaths 数组
                const img = document.createElement('img');
                img.src = path;
                img.alt = '封面预览';
                // img.style.height = '100px'; // 根据你的需求调整
                img.onclick = function () {
                    // 在这里添加你的 onclick 事件处理函数
                    console.log('Image clicked:', path);
                    showImage(path); // 显示被点击的图片
                };
                coverList.appendChild(img); // 为每个图像地址创建一个 img 元素并添加到 coverPreview 元素中

                // 如果是第一张图片，立即显示
                if (index === 0) {
                    showImage(path);
                }
            });
        }
    };

    const showImage = (selectedPath) => {
        coverSelected.innerHTML = '';
        const img = document.createElement('img');
        img.src = selectedPath;
        img.alt = '封面预览';
        // img.style.height = '100px'; // 根据你的需求调整
        coverSelected.appendChild(img);
    };

    // 页面加载完成后，开始向服务器发送请求，直到数据不为空
    const intervalId = setInterval(getImages, 1000);

    const submitText = (title, text) => {
        fetch('http://localhost:3000/generate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: title, text: text }),
        })
            .then(response => response.json())
            .then(() => getImages())
            .catch(error => {
                console.error('Error:', error);
                alert('Error: 您的网络有问题，请稍后再试。');
            });
    };

    form.addEventListener('submit', function (event) {
        event.preventDefault(); // 阻止表单的默认提交行为
        const title = document.querySelector('#title-input-field').value;
        const text = document.querySelector('#text-input-field').value;
        submitText(title, text);
    });
});