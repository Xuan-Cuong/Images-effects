// --- CÁC BIẾN GLOBAL ---
let scene, camera, renderer;
let particleSystem = null; // Đối tượng chứa hiệu ứng hiện tại (Points, Mesh, Group)
let originalImageData = null; // Lưu trữ dữ liệu pixel của ảnh (cho hiệu ứng hạt)
let imageWidth = 0;
let imageHeight = 0;
let imageTexture = null; // Lưu trữ texture ảnh (cho hiệu ứng shader)

const threejsContainer = document.getElementById('threejs-container');
const imageInput = document.getElementById('imageInput');
const effectSelect = document.getElementById('effectSelect');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');
const generateButton = document.getElementById('generateButton');

// --- KHỞI TẠO THREE.JS ---
function initThreeJS() {
    console.log("Khởi tạo Three.js...");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(75, threejsContainer.clientWidth / threejsContainer.clientHeight, 0.1, 2000);
    camera.position.z = 500;
    camera.lookAt(scene.position);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(threejsContainer.clientWidth, threejsContainer.clientHeight);
    threejsContainer.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);
    animate();
    console.log("Đã khởi tạo Three.js và bắt đầu animation loop.");
}

// --- XỬ LÝ SỰ KIỆN WINDOW RESIZE ---
function onWindowResize() {
    const width = threejsContainer.clientWidth;
    const height = threejsContainer.clientHeight;
    if (width <= 0 || height <= 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    console.log(`Window resized: ${width}x${height}`);

    // Cập nhật lại vị trí camera khi resize nếu có ảnh đã load
    if (imageWidth > 0 && imageHeight > 0) {
        repositionCamera(imageWidth, imageHeight);
    }
}

// --- CẬP NHẬT VỊ TRÍ CAMERA DỰA TRÊN KÍCH THƯỚC ẢNH ---
function repositionCamera(imgWidth, imgHeight) {
    const containerAspect = threejsContainer.clientWidth / threejsContainer.clientHeight;
    const imageAspect = imgWidth / imgHeight;
    const targetImageHeight3D = 100; // Chiều cao mục tiêu của ảnh trong không gian 3D
    const targetImageWidth3D = targetImageHeight3D * imageAspect;
    const fovRad = THREE.MathUtils.degToRad(camera.fov);

    // Tính khoảng cách Z cần thiết dựa trên chiều cao ảnh
    let cameraZ_height = (targetImageHeight3D / 2) / Math.tan(fovRad / 2);
     // Tính khoảng cách Z cần thiết dựa trên chiều rộng ảnh
    let cameraZ_width = (targetImageWidth3D / 2) / Math.tan(fovRad / 2) / containerAspect;

    // Lấy khoảng cách Z lớn hơn để đảm bảo toàn bộ ảnh vừa khung nhìn
    let cameraZ = Math.max(cameraZ_height, cameraZ_width);

    camera.position.z = cameraZ * 1.1; // Thêm một chút khoảng cách
    camera.lookAt(scene.position);
}


// --- VÒNG LẶP ANIMATION ---
function animate() {
    
    requestAnimationFrame(animate);

    // Gọi hàm update riêng của từng hiệu ứng nếu có
    if (particleSystem && particleSystem.userData && typeof particleSystem.userData.update === 'function') {
        particleSystem.userData.update();
    }

    renderer.render(scene, camera);
}

// --- XỬ LÝ SỰ KIỆN ---
imageInput.addEventListener('change', handleImageUpload);
generateButton.addEventListener('click', handleGenerateEffect);

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        fileNameDisplay.textContent = 'Chưa có ảnh nào được chọn';
        errorMessage.style.display = 'none';
        originalImageData = null;
        imageWidth = 0;
        imageHeight = 0;
        if (imageTexture) imageTexture.dispose();
        imageTexture = null;
        clearScene();
        return;
    }

    if (!file.type.startsWith('image/')) {
        errorMessage.textContent = 'Vui lòng chọn một file ảnh hợp lệ.';
        errorMessage.style.color = '#ff6666';
        errorMessage.style.display = 'block';
        fileNameDisplay.textContent = 'File không hợp lệ';
        originalImageData = null;
        imageWidth = 0;
        imageHeight = 0;
        if (imageTexture) imageTexture.dispose();
        imageTexture = null;
        clearScene();
        return;
    }

    fileNameDisplay.textContent = file.name;
    errorMessage.style.display = 'none';
    loadingMessage.textContent = 'Đang tải ảnh...';
    loadingMessage.style.display = 'block';

    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            console.log(`Đã tải ảnh: ${img.width}x${img.height}`);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);

            originalImageData = imageData.data; // Lưu data pixel thô cho các hiệu ứng hạt
            imageWidth = img.width;
            imageHeight = img.height;

             // Tạo texture từ canvas cho các hiệu ứng shader
             if (imageTexture) imageTexture.dispose(); // Dispose texture cũ nếu có
             imageTexture = new THREE.CanvasTexture(canvas);
             imageTexture.minFilter = THREE.LinearFilter; // Tùy chọn filter
             imageTexture.magFilter = THREE.LinearFilter;
             imageTexture.wrapS = THREE.ClampToEdgeWrapping; // Tránh lặp texture
             imageTexture.wrapT = THREE.ClampToEdgeWrapping;
             imageTexture.needsUpdate = true; // Báo hiệu cần cập nhật GPU

            loadingMessage.style.display = 'none';
            clearScene();
            repositionCamera(imageWidth, imageHeight); // Cập nhật camera sau khi load ảnh

            errorMessage.textContent = "Ảnh đã tải xong. Chọn hiệu ứng và nhấn 'Tạo Hiệu Ứng'.";
            errorMessage.style.color = '#00cc00';
            errorMessage.style.display = 'block';
        }
        img.onerror = function() {
             errorMessage.textContent = 'Không thể load ảnh.';
             errorMessage.style.color = '#ff6666';
             errorMessage.style.display = 'block';
             loadingMessage.style.display = 'none';
             originalImageData = null;
             imageWidth = 0;
             imageHeight = 0;
             if (imageTexture) imageTexture.dispose();
             imageTexture = null;
             clearScene();
        }
        img.src = e.target.result;
    }

    reader.onerror = function() {
        errorMessage.textContent = 'Không thể đọc file ảnh.';
        errorMessage.style.color = '#ff6666';
        errorMessage.style.display = 'block';
        loadingMessage.style.display = 'none';
        originalImageData = null;
        imageWidth = 0;
        imageHeight = 0;
        if (imageTexture) imageTexture.dispose();
        imageTexture = null;
        clearScene();
    }

    reader.readAsDataURL(file);
}

function handleGenerateEffect() {
     // Kiểm tra xem có dữ liệu ảnh (pixel data HOẶC texture)
     if (!originalImageData && !imageTexture) {
          errorMessage.textContent = 'Vui lòng tải ảnh lên trước khi tạo hiệu ứng.';
          errorMessage.style.color = '#ff6666';
          errorMessage.style.display = 'block';
          return;
     }

     const selectedEffect = effectSelect.value;
     const selectedEffectText = effectSelect.options[effectSelect.selectedIndex].text;

     loadingMessage.textContent = `Đang tạo hiệu ứng "${selectedEffectText}"...`;
     loadingMessage.style.display = 'block';
     errorMessage.style.display = 'none';

     clearScene(); // Xóa hiệu ứng cũ

     try {
         // scaleFactor dựa trên chiều cao 3D mục tiêu (100)
         const targetImageHeight3D = 100;
         const scaleFactor = targetImageHeight3D / imageHeight;

         // step cho các hiệu ứng dựa trên hạt/hình khối
         let step = 2;
         const maxImageDim = Math.max(imageWidth, imageHeight);
         if (maxImageDim > 800) step = 3;
         if (maxImageDim > 1200) step = 4;
         if (maxImageDim > 1800) step = 5;
         // Đảm bảo step không quá lớn
         step = Math.min(step, Math.floor(Math.min(imageWidth, imageHeight) / 10) || 1); // Ít nhất step là 1 nếu ảnh rất nhỏ

         const centerX = imageWidth / 2;
         const centerY = imageHeight / 2;

         // Subdivisions cho PlaneGeometry (cho hiệu ứng shader dựa trên vertex displacement)
         // Càng nhiều subdivision, hiệu ứng displacement càng chi tiết nhưng tốn hiệu năng
         const subdivisions = Math.min(Math.max(imageWidth, imageHeight) / step, 300); // Khoảng 300 subdivisions theo chiều lớn hơn hoặc theo step

         switch (selectedEffect) {
             // --- HIỆU ỨNG HẠT/HÌNH KHỐI (Dùng originalImageData) ---
            case 'particles':
                particleSystem = createParticleEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, step);
                break;
            case 'pixelExplosion':
                 particleSystem = createPixelExplosionEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, step);
                break;
            case 'galaxyTwist':
                 particleSystem = createGalaxyTwistEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, Math.max(step, 2));
                break;
            case 'lightWave':
                particleSystem = createLightWaveEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, step);
                break;
            case 'shapes':
                particleSystem = createShapesEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, Math.max(step, 5));
                break;
             case 'shatter': // Sử dụng logic tương tự shapes
                 particleSystem = createShatterExplodeEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, Math.max(step, 5));
                 break;
             case 'imageMorphing':
                 particleSystem = createImageMorphingEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, step);
                 break;
             case 'particleAttraction':
                 particleSystem = createParticleAttractionEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, step);
                 break;

             // --- HIỆU ỨNG SHADER (Dùng imageTexture) ---
             case 'liquidWave':
                 if (!imageTexture) throw new Error("Image texture not available for Liquid/Wave effect.");
                 particleSystem = createLiquidWaveEffect(imageTexture, imageWidth, imageHeight, scaleFactor, subdivisions);
                 break;
             case 'dissolveMelt':
                 if (!imageTexture) throw new Error("Image texture not available for Dissolve/Melt effect.");
                 particleSystem = createDissolveMeltEffect(imageTexture, imageWidth, imageHeight, scaleFactor);
                 break;
             case 'scannerWipe':
                 if (!imageTexture) throw new Error("Image texture not available for Scanner/Wipe effect.");
                 particleSystem = createScannerWipeEffect(imageTexture, imageWidth, imageHeight, scaleFactor);
                 break;
             case 'displacementMap':
                 if (!imageTexture) throw new Error("Image texture not available for Displacement Map effect.");
                 particleSystem = create3DDepthEffect(imageTexture, imageWidth, imageHeight, scaleFactor, subdivisions);
                 break;
             case 'glitch':
                 if (!imageTexture) throw new Error("Image texture not available for Glitch effect.");
                 particleSystem = createGlitchEffect(imageTexture, imageWidth, imageHeight, scaleFactor);
                 break;
             case 'drawingPainting':
                 if (!imageTexture) throw new Error("Image texture not available for Drawing/Painting effect.");
                 particleSystem = createDrawingPaintingEffect(imageTexture, imageWidth, imageHeight, scaleFactor);
                 break;


            default:
                console.warn(`Hiệu ứng "${selectedEffect}" chưa được hỗ trợ. Sử dụng hiệu ứng mặc định.`);
                particleSystem = createParticleEffect(originalImageData, imageWidth, imageHeight, centerX, centerY, scaleFactor, step);
                break;
        }

        if (particleSystem) {
            scene.add(particleSystem);
            console.log(`Đã thêm hiệu ứng "${selectedEffectText}" vào scene.`);
        } else {
             throw new Error(`Không thể tạo hiệu ứng "${selectedEffectText}". Kết quả là null.`);
        }

         // Cập nhật camera lại sau khi thêm hiệu ứng (một số hiệu ứng có thể thay đổi scale)
         repositionCamera(imageWidth, imageHeight);


     } catch (e) {
         console.error("Error creating effect:", e);
         errorMessage.textContent = `Có lỗi xảy ra khi tạo hiệu ứng "${selectedEffectText}": ${e.message}`;
         errorMessage.style.color = '#ff6666';
         errorMessage.style.display = 'block';
     } finally {
         loadingMessage.style.display = 'none';
     }
}

// --- HÀM XÓA HIỆU ỨNG CŨ ---
function clearScene() {
    if (particleSystem) {
        console.log("Đang xóa hiệu ứng cũ...");

        // Dispose geometry và material của hiệu ứng cũ
        if (particleSystem.geometry) {
            particleSystem.geometry.dispose();
            console.log("Disposed geometry.");
        }
        if (particleSystem.material) {
             if (Array.isArray(particleSystem.material)) {
                 particleSystem.material.forEach(mat => {
                     // Dispose textures if material uses them
                     if (mat.map && typeof mat.map.dispose === 'function') mat.map.dispose();
                     if (mat.uniforms) { // ShaderMaterial uniforms might contain textures
                         for (const uniformName in mat.uniforms) {
                             const uniform = mat.uniforms[uniformName];
                             if (uniform.value && uniform.value.isTexture) {
                                 if (typeof uniform.value.dispose === 'function') uniform.value.dispose();
                             }
                         }
                     }
                     mat.dispose();
                     console.log("Disposed material in array.");
                 });
             } else {
                  // Dispose textures if material uses them
                 if (particleSystem.material.map && typeof particleSystem.material.map.dispose === 'function') particleSystem.material.map.dispose();
                  if (particleSystem.material.uniforms) { // ShaderMaterial uniforms might contain textures
                         for (const uniformName in particleSystem.material.uniforms) {
                             const uniform = particleSystem.material.uniforms[uniformName];
                             if (uniform.value && uniform.value.isTexture) {
                                 if (typeof uniform.value.dispose === 'function') uniform.value.dispose();
                             }
                         }
                     }
                 particleSystem.material.dispose();
                 console.log("Disposed material.");
             }
        }

        // Nếu là Group (như Shapes/Shatter), dispose các mesh con
        if (particleSystem.children && particleSystem.children.length > 0) {
             // Tạo bản sao mảng children để tránh lỗi khi xóa trong khi lặp
             const children = [...particleSystem.children];
             children.forEach(child => {
                  if (child.geometry) child.geometry.dispose();
                  if (child.material) {
                      if (Array.isArray(child.material)) {
                           child.material.forEach(mat => {
                                // Dispose textures if material uses them
                                if (mat.map && typeof mat.map.dispose === 'function') mat.map.dispose();
                                 if (mat.uniforms) { // ShaderMaterial uniforms might contain textures
                                     for (const uniformName in mat.uniforms) {
                                         const uniform = mat.uniforms[uniformName];
                                         if (uniform.value && uniform.value.isTexture) {
                                             if (typeof uniform.value.dispose === 'function') uniform.value.dispose();
                                         }
                                     }
                                 }
                                mat.dispose();
                                console.log("Disposed child material in array.");
                            });
                      } else {
                           // Dispose textures if material uses them
                           if (child.material.map && typeof child.material.map.dispose === 'function') child.material.map.dispose();
                            if (child.material.uniforms) { // ShaderMaterial uniforms might contain textures
                                 for (const uniformName in child.material.uniforms) {
                                     const uniform = child.material.uniforms[uniformName];
                                     if (uniform.value && uniform.value.isTexture) {
                                         if (typeof uniform.value.dispose === 'function') uniform.value.dispose();
                                     }
                                 }
                            }
                          child.material.dispose();
                           console.log("Disposed child material.");
                      }
                  }
                  particleSystem.remove(child); // Loại bỏ mesh con khỏi group
             });
             console.log(`Disposed and removed ${children.length} children.`);
        }

        // Loại bỏ đối tượng chính khỏi scene
        scene.remove(particleSystem);
        particleSystem = null;
        console.log("Đã xóa hiệu ứng cũ.");
    }
}


// --- HÀM HỖ TRỢ: Lấy màu pixel (cho hiệu ứng hạt) ---
function getPixelColor(imageData, width, x, y) {
    const index = (y * width + x) * 4;
    if (index < 0 || index + 3 >= imageData.length) {
        return { r: 0, g: 0, b: 0, a: 0 };
    }
    const r = imageData[index];
    const g = imageData[index + 1];
    const b = imageData[index + 2];
    const a = imageData[index + 3];
    return { r, g, b, a };
}

// --- HÀM HỖ TRỢ: Lấy độ sáng pixel (cho hiệu ứng hạt Displacement Map cũ & Shatter) ---
function getPixelBrightness(imageData, width, x, y) {
     const color = getPixelColor(imageData, width, x, y);
     // Tính độ sáng (luminance) theo công thức phổ biến
     const brightness = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
     return brightness;
}

// --- HÀM HỖ TRỢ: Tạo Plane Mesh được texture và scale phù hợp ---
function createTexturedPlane(texture, imgWidth, imgHeight, scaleFactor, subdivisions = 1) {
    const geometry = new THREE.PlaneGeometry(imgWidth * scaleFactor, imgHeight * scaleFactor, subdivisions, subdivisions);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    // mesh.position.set(0, 0, 0); // PlaneGeometry mặc định tạo ở gốc
    return mesh;
}


// --- CÁC HÀM TẠO HIỆU ỨNG SHADER (Dùng imageTexture) ---

// Shader cơ bản để hiển thị texture
const baseVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const baseFragmentShader = `
    uniform sampler2D u_imageTexture;
    varying vec2 vUv;
    void main() {
        gl_FragColor = texture2D(u_imageTexture, vUv);
    }
`;

// Hiệu ứng 6: Chất lỏng/gợn sóng (Liquid/Wave Effect) - Shader
function createLiquidWaveEffect(texture, imgWidth, imgHeight, scaleFactor, subdivisions) {
    const geometry = new THREE.PlaneGeometry(imgWidth * scaleFactor, imgHeight * scaleFactor, subdivisions, subdivisions);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            u_imageTexture: { value: texture },
            u_time: { value: 0.0 },
            u_waveAmplitude: { value: scaleFactor * 8 }, // Biên độ sóng
            u_waveFrequency: { value: 0.01 / scaleFactor }, // Tần số sóng (không gian)
            u_waveSpeed: { value: 1.5 }, // Tốc độ sóng (thời gian)
            u_noiseScale: { value: scaleFactor * 10 } // Quy mô nhiễu
        },
        vertexShader: `
            uniform float u_time;
            uniform float u_waveAmplitude;
            uniform float u_waveFrequency;
            uniform float u_waveSpeed;
             uniform float u_noiseScale; // Using scale for procedural noise

            varying vec2 vUv;
            varying float vDisplacement;

            // Hàm nhiễu đơn giản 2D (có thể thay bằng noise phức tạp hơn)
            float random (vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
            }
            float noise (vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
                vec2 u = f*f*(3.0-2.0*f);
                return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            void main() {
                vUv = uv;

                // Tính toán độ dịch chuyển Z
                // Kết hợp sóng sin và nhiễu
                float wave = sin(position.x * u_waveFrequency + position.y * u_waveFrequency * 0.8 + u_time * u_waveSpeed) * u_waveAmplitude * 0.5;
                 float noiseVal = noise(uv * u_noiseScale + u_time * 0.1) * u_waveAmplitude * 0.5;

                vDisplacement = wave + noiseVal; // Lưu độ dịch chuyển để truyền sang fragment (ví dụ: đổi màu)

                vec3 newPosition = position + normal * vDisplacement; // Dịch chuyển theo normal (trục Z cho plane)

                gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D u_imageTexture;
            uniform float u_waveAmplitude; // Có thể dùng lại để ảnh hưởng màu sắc

            varying vec2 vUv;
            varying float vDisplacement; // Nhận độ dịch chuyển từ vertex shader

            void main() {
                vec4 color = texture2D(u_imageTexture, vUv);

                 // Tùy chọn: Thay đổi màu sắc hoặc độ sáng dựa trên độ dịch chuyển
                 float brightnessBoost = abs(vDisplacement) / u_waveAmplitude * 0.5; // Tăng sáng khi dịch chuyển nhiều
                 color.rgb += brightnessBoost;
                 color.rgb = clamp(color.rgb, 0.0, 1.0);


                gl_FragColor = color;
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.userData = {
        time: 0,
        speed: 0.015, // Tốc độ animation
        update: function() {
            this.time += this.speed;
            mesh.material.uniforms.u_time.value = this.time; // Cập nhật uniform thời gian
        }
    };
    return mesh;
}

// Hiệu ứng 7: Làm tan chảy/biến mất (Dissolve/Melt Effect) - Shader
function createDissolveMeltEffect(texture, imgWidth, imgHeight, scaleFactor) {
     const geometry = new THREE.PlaneGeometry(imgWidth * scaleFactor, imgHeight * scaleFactor); // Không cần nhiều subdivision nếu chỉ thay đổi alpha

     const material = new THREE.ShaderMaterial({
         uniforms: {
             u_imageTexture: { value: texture },
             u_time: { value: 0.0 }, // threshold animation from 0 to 1
             u_dissolveSpeed: { value: 0.005 }, // Tốc độ tan chảy
             u_noiseScale: { value: 5.0 }, // Quy mô nhiễu (tần suất "lỗ hổng")
         },
         vertexShader: baseVertexShader, // Shader đỉnh cơ bản
         fragmentShader: `
             uniform sampler2D u_imageTexture;
             uniform float u_time; // Biến này sẽ chạy từ 0 đến 1 để kiểm soát ngưỡng
             uniform float u_noiseScale;

             varying vec2 vUv;

             // Hàm nhiễu đơn giản 2D (cần cho hiệu ứng tan chảy không đều)
            float random (vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
            }
            float noise (vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
                vec2 u = f*f*(3.0-2.0*f);
                return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }


             void main() {
                 vec4 color = texture2D(u_imageTexture, vUv);

                 // Lấy giá trị nhiễu tại vị trí pixel
                 float dissolveValue = noise(vUv * u_noiseScale);

                 // Nếu giá trị nhiễu nhỏ hơn ngưỡng (u_time), pixel sẽ tan chảy (alpha = 0)
                 // Ngưỡng tăng dần theo thời gian (u_time đi từ 0 đến 1)
                 if (dissolveValue < u_time) {
                     discard; // Loại bỏ pixel hoàn toàn (tạo lỗ hổng)
                     // hoặc: gl_FragColor = vec4(color.rgb, 0.0); // Chỉ làm trong suốt
                 } else {
                     gl_FragColor = color; // Hiển thị pixel bình thường
                 }
             }
         `,
         transparent: true, // Cần thiết để discard hoặc alpha blending hoạt động
         side: THREE.DoubleSide
     });

     const mesh = new THREE.Mesh(geometry, material);

     mesh.userData = {
         time: 0,
         dissolveSpeed: 0.01, // Tốc độ tăng ngưỡng tan chảy (frame)
         update: function() {
             this.time += this.dissolveSpeed;
             // Giới hạn u_time trong khoảng [0, 1] cho hiệu ứng tan chảy
             mesh.material.uniforms.u_time.value = Math.min(this.time, 1.0);

             // Tùy chọn: dừng animation khi tan chảy hoàn toàn
             if (this.time > 1.5) { // Chờ thêm một chút sau khi u_time đạt 1
                 // this.update = function() {}; // Dừng hàm update
             }
         }
     };
     return mesh;
}


// Hiệu ứng 8: Quét/lộ dần (Scanner/Wipe Effect) - Shader
function createScannerWipeEffect(texture, imgWidth, imgHeight, scaleFactor) {
    const geometry = new THREE.PlaneGeometry(imgWidth * scaleFactor, imgHeight * scaleFactor); // Không cần nhiều subdivision

    const material = new THREE.ShaderMaterial({
        uniforms: {
            u_imageTexture: { value: texture },
            u_time: { value: 0.0 }, // Vị trí quét, sẽ đi từ 0 đến chiều rộng
            u_scanWidth: { value: imgWidth * scaleFactor }, // Chiều rộng của mặt phẳng ảnh 3D
            u_scanSpeed: { value: 0.01 }, // Tốc độ quét (tăng u_time)
            u_scanLineThickness: { value: scaleFactor * 0.5 }, // Độ dày của vạch quét
            u_scanColor: { value: new THREE.Color(0.0, 1.0, 1.0) }, // Màu vạch quét (cyan)
            u_effectAmount: { value: 1.0 } // Cường độ hiệu ứng (ví dụ: grayscale)
        },
        vertexShader: `
             varying vec2 vUv;
             varying vec3 vPosition; // Truyền vị trí vertex để so sánh với scanline

            void main() {
                vUv = uv;
                vPosition = position; // Vị trí trong không gian model (trước biến đổi modelView/projection)
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D u_imageTexture;
            uniform float u_time; // Vị trí quét (0 đến u_scanWidth)
            uniform float u_scanWidth;
            uniform float u_scanLineThickness;
            uniform vec3 u_scanColor;
            uniform float u_effectAmount;

            varying vec2 vUv;
            varying vec3 vPosition; // Vị trí vertex từ vertex shader

            // Hàm chuyển màu RGB sang Grayscale
            float toGrayscale(vec3 color) {
                return dot(color, vec3(0.299, 0.587, 0.114));
            }

            void main() {
                vec4 color = texture2D(u_imageTexture, vUv);

                // Tính vị trí tương đối của pixel so với đường quét
                float scanProgress = (vPosition.x + u_scanWidth * 0.5) / u_scanWidth; // Chuẩn hóa vị trí X từ -width/2 -> width/2 về 0 -> 1
                 float scanLinePos = mod(u_time, u_scanWidth + u_scanLineThickness * 2.0) - u_scanLineThickness; // Vị trí quét lặp lại

                 // Tính khoảng cách đến vạch quét
                 float distToScanLine = abs(vPosition.x - scanLinePos);


                // Hiển thị ảnh dựa trên vị trí so với vạch quét
                vec3 finalColor = color.rgb;

                // Áp dụng hiệu ứng trước khi quét (ví dụ: grayscale)
                 if (vPosition.x < scanLinePos) {
                     finalColor = mix(color.rgb, vec3(toGrayscale(color.rgb)), u_effectAmount); // Trộn màu gốc với grayscale
                 }

                 // Vẽ vạch quét
                 if (distToScanLine < u_scanLineThickness * 0.5) {
                     // Điều chỉnh độ sáng hoặc màu sắc tại vạch quét
                      float scanLineAlpha = 1.0 - smoothstep(0.0, u_scanLineThickness * 0.5, distToScanLine); // Alpha mượt
                     finalColor = mix(finalColor, u_scanColor * (1.0 + sin(u_time * 10.0) * 0.1), scanLineAlpha); // Trộn màu cuối cùng với màu quét
                 }


                gl_FragColor = vec4(finalColor, color.a);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.userData = {
        time: 0,
        scanSpeed: 0.01, // Tốc độ tăng biến time
        update: function() {
            this.time += this.scanSpeed;
            // u_time trong shader sẽ là giá trị tăng liên tục để tạo hiệu ứng lặp lại
            mesh.material.uniforms.u_time.value = this.time * mesh.material.uniforms.u_scanSpeed.value;
        }
    };
    return mesh;
}

// Hiệu ứng 9: Đổ vỡ/tách mảnh (Shatter/Explode Effect) - Dựa trên Mesh
function createShatterExplodeEffect(imageData, width, height, centerX, centerY, scaleFactor, step) {
    const group = new THREE.Group();
    const boxSize = scaleFactor * (step * 0.8); // Kích thước khối
    let meshData = []; // Lưu trữ vị trí ban đầu, vận tốc, và màu sắc cho mỗi khối

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const color = getPixelColor(imageData, width, x, y);
            // Chỉ tạo khối cho các pixel không trong suốt hoặc đủ sáng
            const brightness = getPixelBrightness(imageData, width, x, y);
            if (color.a > 10 || brightness > 0.1) { // Sử dụng cả alpha và brightness
                const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
                const material = new THREE.MeshBasicMaterial({
                     color: new THREE.Color(color.r / 255, color.g / 255, color.b / 255)
                     // transparent: color.a < 255, // Có thể làm các khối trong suốt hơn
                     // opacity: color.a / 255
                });
                const mesh = new THREE.Mesh(geometry, material);

                const initialX = (x - centerX) * scaleFactor;
                const initialY = -(y - centerY) * scaleFactor;
                const initialZ = 0;

                mesh.position.set(initialX, initialY, initialZ);
                group.add(mesh);

                // Tính toán vận tốc đẩy ban đầu (hướng ra ngoài hoặc ngẫu nhiên)
                const direction = new THREE.Vector3(initialX, initialY, (Math.random() - 0.5) * scaleFactor * 2); // Thêm ngẫu nhiên Z
                direction.normalize();
                const speed = (Math.random() * scaleFactor * 10) + (scaleFactor * 5); // Vận tốc ngẫu nhiên
                const velocity = direction.multiplyScalar(speed);

                // Lưu trữ data riêng cho mesh này
                meshData.push({
                    mesh: mesh,
                    initialPosition: new THREE.Vector3(initialX, initialY, initialZ),
                    velocity: velocity,
                    rotationSpeed: new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1)
                });
            }
        }
    }
     console.log(`ShatterExplodeEffect: Tạo ${group.children.length} khối.`);
      if (group.children.length === 0) {
        console.warn("ShatterExplodeEffect: Không tìm thấy pixel đủ mờ/sáng để tạo khối.");
        // Cần dispose geometry/material nếu đã tạo trước vòng lặp và không dùng
        // Nếu tạo mới trong vòng lặp và không add vào group, chúng sẽ bị rò rỉ.
        // Cách tốt nhất là dispose chúng ở đây nếu group rỗng, nhưng phức tạp.
        // Hiện tại, hàm clearScene sẽ dispose các mesh được add vào group.
        return null;
    }

    group.userData = {
        meshData: meshData, // Mảng chứa data cho từng mesh
        time: 0,
        gravity: new THREE.Vector3(0, -scaleFactor * 0.1, 0), // Trọng lực
        damping: 0.98, // Hệ số giảm xóc
        update: function() {
            this.time++;

            this.meshData.forEach(data => {
                // Áp dụng trọng lực (tăng dần vận tốc Y âm)
                data.velocity.add(this.gravity);

                // Cập nhật vị trí dựa trên vận tốc
                data.mesh.position.add(data.velocity);

                // Áp dụng giảm xóc cho vận tốc
                data.velocity.multiplyScalar(this.damping);

                // Quay khối
                data.mesh.rotation.x += data.rotationSpeed.x;
                data.mesh.rotation.y += data.rotationSpeed.y;
                data.mesh.rotation.z += data.rotationSpeed.z;
            });
             // Tùy chọn: Xóa các mảnh bay quá xa hoặc biến mất sau một thời gian
        }
    };

    // Bắt đầu animation đẩy
    setTimeout(() => {
         // Không cần làm gì ở đây nếu logic đẩy nằm trong userData.update
         // Có thể reset trạng thái hoặc thêm lực đẩy ban đầu ở đây nếu muốn animation lặp lại
    }, 100); // Ví dụ: Đợi 100ms trước khi bắt đầu hiệu ứng (nếu cần)


    return group;
}


// Hiệu ứng 10: Ảnh 3D (3D Depth/Extrusion) - Shader (Vertex Displacement)
function create3DDepthEffect(texture, imgWidth, imgHeight, scaleFactor, subdivisions) {
    const geometry = new THREE.PlaneGeometry(imgWidth * scaleFactor, imgHeight * scaleFactor, subdivisions, subdivisions);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            u_imageTexture: { value: texture },
            u_time: { value: 0.0 }, // Có thể dùng cho animation độ sâu
            u_depthScale: { value: scaleFactor * 15 }, // Hệ số scale độ sâu tối đa
        },
        vertexShader: `
            uniform sampler2D u_imageTexture;
            uniform float u_time;
            uniform float u_depthScale;

            varying vec2 vUv;

            // Hàm chuyển màu RGB sang Grayscale (cho độ sáng)
            float toGrayscale(vec3 color) {
                return dot(color, vec3(0.299, 0.587, 0.114));
            }

            void main() {
                vUv = uv;

                // Lấy màu pixel từ texture tại vị trí vertex
                vec4 texColor = texture2D(u_imageTexture, vUv);
                // Tính độ sáng (luminance)
                float brightness = toGrayscale(texColor.rgb);

                // Dịch chuyển vertex theo trục Z dựa trên độ sáng
                // Điều chỉnh độ sáng (0-1) để vùng tối có thể lõm xuống (<0.5) và vùng sáng lồi lên (>0.5)
                 float displacement = (brightness - 0.5) * 2.0 * u_depthScale; // brightness 0-1 -> displacement -depthScale to +depthScale

                vec3 newPosition = position;
                newPosition.z += displacement; // Dịch chuyển theo trục Z

                gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
            }
        `,
        fragmentShader: baseFragmentShader, // Shader fragment cơ bản hiển thị màu texture
        transparent: true,
        side: THREE.DoubleSide // Hiển thị cả 2 mặt
    });

    const mesh = new THREE.Mesh(geometry, material);

     mesh.userData = {
        time: 0,
        speed: 0.01, // Tốc độ animation (nếu muốn animate depthScale)
        update: function() {
             // Example: Animate rotation
             mesh.rotation.y += 0.002;
             mesh.rotation.x += 0.001;

             // Example: Animate depth scale
             // this.time += this.speed;
             // mesh.material.uniforms.u_depthScale.value = scaleFactor * 10 + Math.sin(this.time) * scaleFactor * 5;

             // Cần báo hiệu Three.js cập nhật uniforms nếu chúng thay đổi
             // mesh.material.uniformsNeedUpdate = true; // Chỉ cần nếu uniforms thay đổi trong update
        }
    };

    return mesh;
}


// Hiệu ứng 11: Glitch (Glitch Effect) - Shader
function createGlitchEffect(texture, imgWidth, imgHeight, scaleFactor) {
     const geometry = new THREE.PlaneGeometry(imgWidth * scaleFactor, imgHeight * scaleFactor);

     const material = new THREE.ShaderMaterial({
         uniforms: {
             u_imageTexture: { value: texture },
             u_time: { value: 0.0 },
             u_glitchIntensity: { value: 0.05 }, // Cường độ dịch chuyển UV (0.0 - 0.1)
             u_resolution: { value: new THREE.Vector2(imgWidth, imgHeight) } // Độ phân giải ảnh gốc
         },
         vertexShader: baseVertexShader,
         fragmentShader: `
             uniform sampler2D u_imageTexture;
             uniform float u_time;
             uniform float u_glitchIntensity;
             uniform vec2 u_resolution;

             varying vec2 vUv;

             // Hàm nhiễu (Fractal Brownian Motion - FBM) cho hiệu ứng phức tạp hơn
             // Nguồn: https://thebookofshaders.com/13/
             float random (vec2 st) {
                 return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
             }
             float noise (vec2 st) {
                 vec2 i = floor(st);
                 vec2 f = fract(st);
                 float a = random(i);
                 float b = random(i + vec2(1.0, 0.0));
                 float c = random(i + vec2(0.0, 1.0));
                 float d = random(i + vec2(1.0, 1.0));
                 vec2 u = f*f*(3.0-2.0*f);
                 return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
             }
             float fbm (vec2 st) {
                 float value = 0.0;
                 float amplitude = 0.5;
                 float frequency = 0.0;
                 for (int i = 0; i < 4; i++) { // Số lần lặp (octaves)
                     value += amplitude * noise(st);
                     st *= 2.0; // Tần số tăng gấp đôi
                     amplitude *= 0.5; // Biên độ giảm một nửa
                 }
                 return value;
             }

             void main() {
                 vec2 uv = vUv;

                 // Tạo offset ngẫu nhiên dựa trên nhiễu và thời gian
                 // Làm nhiễu theo trục Y để tạo hiệu ứng xé ngang
                 float glitchOffset = fbm(vec2(uv.y * 10.0, u_time * 5.0)) * u_glitchIntensity;

                 // Dịch chuyển UV theo trục X
                 uv.x += glitchOffset;

                  // Thêm hiệu ứng đổi màu/split channel ngẫu nhiên
                  vec4 color;
                  float timeFactor = sin(u_time * 10.0); // Giá trị thay đổi nhanh
                   if (timeFactor > 0.8) { // Glitch mạnh
                      color.r = texture2D(u_imageTexture, uv + vec2(glitchOffset * 0.5, 0.0)).r;
                      color.g = texture2D(u_imageTexture, uv).g;
                      color.b = texture2D(u_imageTexture, uv - vec2(glitchOffset * 0.5, 0.0)).b;
                      color.a = texture2D(u_imageTexture, uv).a;
                   } else if (timeFactor > 0.5) { // Glitch nhẹ
                      color = texture2D(u_imageTexture, uv);
                      color.r *= (1.0 + sin(u_time * 50.0) * 0.1);
                      color.b *= (1.0 + cos(u_time * 60.0) * 0.1);
                   }
                   else { // Chỉ dịch chuyển UV
                       color = texture2D(u_imageTexture, uv);
                   }


                gl_FragColor = color;
            }
         `,
         transparent: true,
         side: THREE.DoubleSide
     });

     const mesh = new THREE.Mesh(geometry, material);

     mesh.userData = {
         time: 0,
         speed: 0.01, // Tốc độ tăng biến time
         glitchActiveDuration: 0.05, // Thời gian glitch thực sự (ví dụ: 5% của chu kỳ sin)
         update: function() {
             this.time += this.speed;
             // Tạo hiệu ứng glitch ngắt quãng bằng cách kiểm tra giá trị sin
             const sinTime = Math.sin(this.time * 10.0); // Biến đổi thời gian cho nhanh hơn
             if (sinTime > (1.0 - this.glitchActiveDuration * 2.0)) { // Kích hoạt glitch khi sin gần đỉnh
                  mesh.material.uniforms.u_glitchIntensity.value = THREE.MathUtils.lerp(0.0, 0.1, (sinTime - (1.0 - this.glitchActiveDuration * 2.0)) / (this.glitchActiveDuration * 2.0)); // Tăng cường độ mượt mà
             } else if (sinTime < (-1.0 + this.glitchActiveDuration * 2.0)) { // Kích hoạt glitch khi sin gần đáy
                  mesh.material.uniforms.u_glitchIntensity.value = THREE.MathUtils.lerp(0.0, 0.1, (-sinTime - (1.0 - this.glitchActiveDuration * 2.0)) / (this.glitchActiveDuration * 2.0)); // Tăng cường độ mượt mà
             }
             else {
                 mesh.material.uniforms.u_glitchIntensity.value = 0.0; // Tắt glitch
             }


             mesh.material.uniforms.u_time.value = this.time; // Cập nhật uniform thời gian
             // mesh.material.uniformsNeedUpdate = true; // Chỉ cần nếu uniforms thay đổi giá trị liên tục
         }
     };
     return mesh;
}

// Hiệu ứng 12: Vẽ/Tô màu (Drawing/Painting Effect) - Shader
function createDrawingPaintingEffect(texture, imgWidth, imgHeight, scaleFactor) {
     const geometry = new THREE.PlaneGeometry(imgWidth * scaleFactor, imgHeight * scaleFactor); // Không cần nhiều subdivision nếu không displace vertex

     const material = new THREE.ShaderMaterial({
         uniforms: {
             u_imageTexture: { value: texture },
             u_time: { value: 0.0 }, // Tiến trình vẽ (0 đến 1)
             u_progressSpeed: { value: 0.001 }, // Tốc độ vẽ (tăng u_time)
             u_patternScale: { value: 5.0 }, // Quy mô pattern (tần số đường nét)
             u_patternDensity: { value: 1.0 }, // Mật độ pattern (độ dày/khoảng cách nét)
         },
         vertexShader: baseVertexShader,
         fragmentShader: `
             uniform sampler2D u_imageTexture;
             uniform float u_time; // Tiến trình (0 đến 1)
             uniform float u_patternScale;
             uniform float u_patternDensity;

             varying vec2 vUv;

            // Hàm nhiễu cơ bản (cho pattern vẽ ngẫu nhiên hơn)
             float random (vec2 st) {
                 return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
             }
             float noise (vec2 st) {
                 vec2 i = floor(st);
                 vec2 f = fract(st);
                 float a = random(i);
                 float b = random(i + vec2(1.0, 0.0));
                 float c = random(i + vec2(0.0, 1.0));
                 float d = random(i + vec2(1.0, 1.0));
                 vec2 u = f*f*(3.0-2.0*f);
                 return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
             }


             void main() {
                 vec4 color = texture2D(u_imageTexture, vUv);

                 // Tạo pattern dựa trên UV và nhiễu
                 // float patternValue = vUv.x; // Quét ngang đơn giản
                 // float patternValue = vUv.x + vUv.y; // Quét chéo
                  float patternValue = noise(vUv * u_patternScale) * u_patternDensity + (vUv.x + vUv.y) * 0.5; // Kết hợp nhiễu và quét chéo


                 // Hiển thị pixel nếu patternValue nhỏ hơn tiến trình (u_time)
                 if (patternValue < u_time) {
                     gl_FragColor = color; // Hiển thị màu ảnh
                 } else {
                     // Có thể hiển thị màu nền hoặc màu "chưa vẽ"
                     // gl_FragColor = vec4(0.1, 0.1, 0.1, 1.0); // Màu xám
                      discard; // Hoặc loại bỏ pixel hoàn toàn
                 }
             }
         `,
         transparent: true,
         side: THREE.DoubleSide
     });

     const mesh = new THREE.Mesh(geometry, material);

     mesh.userData = {
         time: 0,
         progressSpeed: 0.005, // Tốc độ tăng u_time
         update: function() {
             this.time += this.progressSpeed;
             // Giới hạn u_time từ 0 đến khoảng 1.5 để pattern hoàn thành
             mesh.material.uniforms.u_time.value = Math.min(this.time, 1.5);

             // Tùy chọn: Dừng animation hoặc lặp lại khi hoàn thành
             if (this.time > 2.0) { // Chờ thêm một chút sau khi hoàn thành
                // this.time = 0; // Lặp lại
             }
         }
     };
     return mesh;
}


// --- CÁC HÀM TẠO HIỆU ỨNG HẠT/HÌNH KHỐI (Dùng originalImageData) ---
// (Giữ lại các hiệu ứng từ yêu cầu trước)

// Hiệu ứng 1: Các hạt chuyển động
function createParticleEffect(imageData, width, height, centerX, centerY, scaleFactor, step) {
    const vertices = [];
    const colors = [];

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const color = getPixelColor(imageData, width, x, y);
            if (color.a > 10) { // Chỉ lấy các pixel có alpha > 10 (gần như không trong suốt)
                const vx = (x - centerX) * scaleFactor;
                const vy = -(y - centerY) * scaleFactor;
                const vz = 0; // Bắt đầu ở mặt phẳng z=0
                vertices.push(vx, vy, vz);
                colors.push(color.r / 255, color.g / 255, color.b / 255);
            }
        }
    }
    console.log(`ParticleEffect: Tạo ${vertices.length / 3} hạt.`);
    if (vertices.length === 0) {
        console.warn("ParticleEffect: Không tìm thấy pixel đủ mờ để tạo hạt.");
        return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 2 * scaleFactor, // Kích thước hạt phụ thuộc scaleFactor
        vertexColors: true, // Sử dụng màu từ attribute 'color'
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending // Hiệu ứng sáng khi các hạt chồng lên nhau
    });

    const points = new THREE.Points(geometry, material);
    const initialPositions = new Float32Array(geometry.attributes.position.array); // Lưu vị trí ban đầu

    points.userData = {
        initialPositions: initialPositions, // Lưu vị trí ban đầu
        time: 0,
        speed: 0.001, // Tốc độ animation
        waveScale: scaleFactor * 2, // Biên độ sóng
        update: function() { // Hàm update sẽ chạy trong vòng lặp animate
           const positions = points.geometry.attributes.position.array; // Lấy mảng vị trí
           const initialPos = this.initialPositions;
           this.time += this.speed;

            for (let i = 0; i < positions.length; i += 3) {
                const initialX = initialPos[i];
                const initialY = initialPos[i + 1];
                const initialZ = initialPos[i + 2];

                // Áp dụng sóng sin/cos vào vị trí
                const moveSpeed = this.waveScale * 0.5; // Điều chỉnh biên độ di chuyển
                positions[i] = initialX + Math.sin(initialY * 0.01 + this.time * 3) * moveSpeed;
                positions[i + 1] = initialY + Math.cos(initialX * 0.01 + this.time * 4) * moveSpeed;
                positions[i + 2] = initialZ + Math.sin((initialX * 0.005 + initialY * 0.005) + this.time * 5) * moveSpeed * 0.5;
            }
            points.geometry.attributes.position.needsUpdate = true; // Báo hiệu Three.js cập nhật geometry
        }
    };
    return points;
}

// Hiệu ứng 2: Pixel Explosion
function createPixelExplosionEffect(imageData, width, height, centerX, centerY, scaleFactor, step) {
    const vertices = [];
    const colors = [];
    const velocities = []; // Thêm mảng lưu vận tốc

     for (let y = 0; y < height; y += step) {
         for (let x = 0; x < width; x += step) {
            const color = getPixelColor(imageData, width, x, y);
            if (color.a > 10) {
                const vx = (x - centerX) * scaleFactor;
                const vy = -(y - centerY) * scaleFactor;
                const vz = 0;
                vertices.push(vx, vy, vz);
                colors.push(color.r / 255, color.g / 255, color.b / 255);

                // Tính vận tốc ban đầu hướng ra ngoài từ trung tâm
                const direction = new THREE.Vector3(vx, vy, vz).normalize();
                const speed = Math.random() * scaleFactor * 5 + scaleFactor * 2; // Vận tốc ngẫu nhiên
                const velX = direction.x * speed;
                const velY = direction.y * speed;
                const velZ = (Math.random() - 0.5) * speed * 0.5; // Thêm vận tốc ngẫu nhiên theo Z
                velocities.push(velX, velY, velZ);
            }
        }
    }
     console.log(`PixelExplosionEffect: Tạo ${vertices.length / 3} hạt.`);
      if (vertices.length === 0) {
        console.warn("PixelExplosionEffect: Không tìm thấy pixel đủ mờ để tạo hạt.");
        return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3)); // Thêm attribute velocity

    const material = new THREE.PointsMaterial({
        size: 2 * scaleFactor,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);

    points.userData = {
        gravity: new THREE.Vector3(0, -scaleFactor * 0.05, 0), // Lực hấp dẫn (có thể hướng xuống)
        damping: 0.98, // Hệ số giảm xóc
        update: function() {
           const positions = points.geometry.attributes.position.array;
           const velocitiesArr = points.geometry.attributes.velocity.array; // Lấy mảng vận tốc

            for (let i = 0; i < positions.length; i += 3) {
                // Áp dụng trọng lực
                velocitiesArr[i] += this.gravity.x;
                velocitiesArr[i + 1] += this.gravity.y;
                velocitiesArr[i + 2] += this.gravity.z;

                // Cập nhật vị trí dựa trên vận tốc
                positions[i] += velocitiesArr[i] * 0.1;
                positions[i + 1] += velocitiesArr[i + 1] * 0.1;
                positions[i + 2] += velocitiesArr[i + 2] * 0.1;

                // Áp dụng giảm xóc
                velocitiesArr[i] *= this.damping;
                velocitiesArr[i + 1] *= this.damping;
                velocitiesArr[i + 2] *= this.damping;
            }
            points.geometry.attributes.position.needsUpdate = true;
            points.geometry.attributes.velocity.needsUpdate = true; // Báo hiệu Three.js cập nhật vận tốc (dù không hiển thị, vận tốc thay đổi)
        }
    };
    return points;
}

// Hiệu ứng 3: Galaxy Twist
function createGalaxyTwistEffect(imageData, width, height, centerX, centerY, scaleFactor, step) {
     const vertices = [];
     const colors = [];
     const initialPositionsData = []; // Lưu vị trí ban đầu

     for (let y = 0; y < height; y += step) {
         for (let x = 0; x < width; x += step) {
             const color = getPixelColor(imageData, width, x, y);
             if (color.a > 10) {
                 const vx = (x - centerX) * scaleFactor;
                 const vy = -(y - centerY) * scaleFactor;
                 const vz = 0;
                 vertices.push(vx, vy, vz);
                 initialPositionsData.push(vx, vy, vz); // Lưu vị trí ban đầu
                 colors.push(color.r / 255, color.g / 255, color.b / 255);
             }
         }
     }
     console.log(`GalaxyTwistEffect: Tạo ${vertices.length / 3} hạt.`);
      if (vertices.length === 0) {
        console.warn("GalaxyTwistEffect: Không tìm thấy pixel đủ mờ để tạo hạt.");
        return null;
    }

     const geometry = new THREE.BufferGeometry();
     geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
     geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

     const material = new THREE.PointsMaterial({
         size: 2 * scaleFactor,
         vertexColors: true,
         transparent: true,
         opacity: 1.0,
         blending: THREE.AdditiveBlending
     });

     const points = new THREE.Points(geometry, material);

     points.userData = {
         initialPositions: new Float32Array(initialPositionsData),
         time: 0,
         speed: 0.005, // Tốc độ animation
         twistFactor: 0.005 / scaleFactor, // Hệ số xoắn (phụ thuộc scale)
         zWaveHeight: scaleFactor * 5, // Chiều cao sóng Z
         zWaveDensity: 0.01 / scaleFactor, // Mật độ sóng Z
         rotationSpeed: 0.002, // Tốc độ quay tổng thể
         update: function() {
             const positions = points.geometry.attributes.position.array;
             const initialPos = this.initialPositions;
             this.time += this.speed;

             points.rotation.y += this.rotationSpeed; // Quay toàn bộ hệ thống

             for (let i = 0; i < positions.length; i += 3) {
                 const ix = initialPos[i];
                 const iy = initialPos[i + 1];
                 const iz = initialPos[i + 2];

                 // Chuyển sang hệ tọa độ cực, thêm góc xoắn theo khoảng cách, rồi chuyển về Descartes
                 const distance = Math.sqrt(ix * ix + iy * iy);
                 const angle = Math.atan2(iy, ix) + distance * this.twistFactor + this.time * 5; // Thêm góc xoắn và thời gian

                 positions[i] = distance * Math.cos(angle);
                 positions[i + 1] = distance * Math.sin(angle);
                 // Thêm sóng Z dựa trên vị trí ban đầu và thời gian
                 positions[i + 2] = iz + Math.sin((ix * this.zWaveDensity + iy * this.zWaveDensity) + this.time * 10) * this.zWaveHeight;
             }
             points.geometry.attributes.position.needsUpdate = true;
         }
     };
     return points;
}

// Hiệu ứng 4: Sóng Ánh Sáng
function createLightWaveEffect(imageData, width, height, centerX, centerY, scaleFactor, step) {
     const vertices = [];
     const colors = [];
     const initialPositionsData = [];

     for (let y = 0; y < height; y += step) {
         for (let x = 0; x < width; x += step) {
             const color = getPixelColor(imageData, width, x, y);
             if (color.a > 10) {
                 const vx = (x - centerX) * scaleFactor;
                 const vy = -(y - centerY) * scaleFactor;
                 const vz = 0;
                 vertices.push(vx, vy, vz);
                 initialPositionsData.push(vx, vy, vz);
                 colors.push(color.r / 255, color.g / 255, color.b / 255);
             }
         }
     }
     console.log(`LightWaveEffect: Tạo ${vertices.length / 3} hạt.`);
      if (vertices.length === 0) {
        console.warn("LightWaveEffect: Không tìm thấy pixel đủ mờ để tạo hạt.");
        return null;
    }

     const geometry = new THREE.BufferGeometry();
     geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
     geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

     const material = new THREE.PointsMaterial({
         size: 2 * scaleFactor,
         vertexColors: true,
         transparent: true,
         opacity: 1.0,
         blending: THREE.AdditiveBlending
     });

     const points = new THREE.Points(geometry, material);

     points.userData = {
         initialPositions: new Float32Array(initialPositionsData),
         time: 0,
         waveSpeed: 0.05, // Tốc độ sóng
         waveHeight: scaleFactor * 10, // Biên độ sóng Z
         waveDensityX: 0.05 / scaleFactor, // Mật độ sóng theo X
         waveDensityY: 0.05 / scaleFactor, // Mật độ sóng theo Y
         update: function() {
             const positions = points.geometry.attributes.position.array;
             const initialPos = this.initialPositions;
             this.time += this.waveSpeed;

             for (let i = 0; i < positions.length; i += 3) {
                 const ix = initialPos[i];
                 const iy = initialPos[i + 1];
                 const iz = initialPos[i + 2];

                 // Tính giá trị sóng dựa trên vị trí X, Y ban đầu và thời gian
                 const waveValue = Math.sin(ix * this.waveDensityX + this.time) +
                                   Math.cos(iy * this.waveDensityY + this.time * 0.7); // Kết hợp 2 sóng

                 positions[i] = ix;
                 positions[i + 1] = iy;
                 positions[i + 2] = iz + waveValue * (this.waveHeight * 0.5); // Áp dụng vào trục Z
             }
             points.geometry.attributes.position.needsUpdate = true;
         }
     };
     return points;
}

// Hiệu ứng 5: Các Hình Khối (Mesh)
function createShapesEffect(imageData, width, height, centerX, centerY, scaleFactor, step) {
    const group = new THREE.Group();
    // Kích thước hình khối phụ thuộc vào step và scaleFactor
    const boxSize = scaleFactor * (step * 0.8);
    let meshInitialPositions = []; // Lưu vị trí ban đầu của từng mesh

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const color = getPixelColor(imageData, width, x, y);
            if (color.a > 10) {
                // Sử dụng cùng một geometry và material nhưng set màu riêng cho từng mesh
                const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
                const material = new THREE.MeshBasicMaterial({
                     color: new THREE.Color(color.r / 255, color.g / 255, color.b / 255)
                     // transparent: color.a < 255,
                     // opacity: color.a / 255
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.x = (x - centerX) * scaleFactor;
                mesh.position.y = -(y - centerY) * scaleFactor;
                mesh.position.z = 0;
                group.add(mesh);
                // Lưu vị trí ban đầu (sử dụng clone() để lưu bản sao giá trị)
                meshInitialPositions.push(mesh.position.clone());
            }
        }
    }
     console.log(`ShapesEffect: Tạo ${group.children.length} khối.`);
      if (group.children.length === 0) {
        console.warn("ShapesEffect: Không tìm thấy pixel đủ mờ để tạo khối.");
        return null;
    }

     group.userData = {
         initialPositions: meshInitialPositions, // Mảng các Vector3 lưu vị trí ban đầu
         time: 0,
         speed: 0.005,
         zWaveHeight: scaleFactor * 8,
         zWaveDensity: 0.002 / scaleFactor,
         rotationSpeed: 0.001,
         update: function() {
            this.time += this.speed;

            // Quay toàn bộ group
            group.rotation.y += this.rotationSpeed;
            // group.rotation.x += this.rotationSpeed * 0.5;

            // Cập nhật vị trí Z của từng mesh con dựa trên vị trí ban đầu và sóng thời gian
             group.children.forEach((mesh, index) => {
                 const initialPos = this.initialPositions[index]; // Lấy Vector3 vị trí ban đầu
                 if (initialPos) { // Kiểm tra tồn tại (phòng trường hợp lỗi)
                    mesh.position.z = initialPos.z + Math.sin((initialPos.x * this.zWaveDensity + initialPos.y * this.zWaveDensity) + this.time * 5) * this.zWaveHeight;
                 }
                 // Quay từng khối nhỏ
                 mesh.rotation.x += this.rotationSpeed * 2;
                 mesh.rotation.y += this.rotationSpeed * 3;
             });
         }
     };
    return group;
}

// Hiệu ứng 13: Image Morphing (Biến đổi hình ảnh) - Giữ lại từ trước
function createImageMorphingEffect(imageData, width, height, centerX, centerY, scaleFactor, step) {
     const vertices = []; // Vị trí hiện tại (sẽ thay đổi)
     const colors = [];
     const initialPositionsData = []; // Vị trí ban đầu (tạo hình ảnh)
     const targetPositionsData = []; // Vị trí đích (ngẫu nhiên)

     for (let y = 0; y < height; y += step) {
         for (let x = 0; x < width; x += step) {
            const color = getPixelColor(imageData, width, x, y);
            if (color.a > 10) {
                // Vị trí ban đầu là vị trí ảnh
                const vx = (x - centerX) * scaleFactor;
                const vy = -(y - centerY) * scaleFactor;
                const vz = 0;
                vertices.push(vx, vy, vz);
                initialPositionsData.push(vx, vy, vz); // Lưu lại vị trí ảnh

                // Vị trí đích ngẫu nhiên trong không gian 3D
                const maxDimScale = scaleFactor * Math.max(width, height);
                const tx = (Math.random() - 0.5) * maxDimScale * 2;
                const ty = (Math.random() - 0.5) * maxDimScale * 2;
                const tz = (Math.random() - 0.5) * maxDimScale * 2;
                targetPositionsData.push(tx, ty, tz);

                colors.push(color.r / 255, color.g / 255, color.b / 255);
            }
        }
     }
     console.log(`ImageMorphingEffect: Tạo ${vertices.length / 3} hạt.`);
      if (vertices.length === 0) {
        console.warn("ImageMorphingEffect: Không tìm thấy pixel đủ mờ để tạo hạt.");
        return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 2 * scaleFactor,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);

    points.userData = {
        initialPositions: new Float32Array(initialPositionsData),
        targetPositions: new Float32Array(targetPositionsData), // Vị trí đích ngẫu nhiên
        time: 0,
        morphDuration: 150, // Thời gian chuyển đổi (frame)
        holdDuration: 60, // Thời gian giữ
        state: 'toTarget', // 'toTarget', 'holdTarget', 'toInitial', 'holdInitial'
        update: function() {
           const positions = points.geometry.attributes.position.array;
           const initialPos = this.initialPositions;
           const targetPos = this.targetPositions;

           this.time++; // Tăng frame count

           let progress = 0;
           if (this.state === 'toTarget') {
               progress = Math.min(this.time / this.morphDuration, 1);
               if (progress === 1) {
                   this.state = 'holdTarget';
                   this.time = 0;
               }
           } else if (this.state === 'holdTarget') {
               progress = 1;
               if (this.time >= this.holdDuration) {
                   this.state = 'toInitial';
                   this.time = 0;
               }
           } else if (this.state === 'toInitial') {
               progress = 1 - Math.min(this.time / this.morphDuration, 1);
               if (progress === 0) {
                    this.state = 'holdInitial';
                    this.time = 0;
               }
           } else if (this.state === 'holdInitial') {
               progress = 0;
               if (this.time >= this.holdDuration) {
                    this.state = 'toTarget'; // Lặp lại hiệu ứng
                    this.time = 0;
               }
           }

           // Sử dụng hàm làm mượt (easing function) cho chuyển động
           const easedProgress = THREE.MathUtils.smoothstep(progress, 0, 1);


            for (let i = 0; i < positions.length; i += 3) {
                const ix = initialPos[i];
                const iy = initialPos[i + 1];
                const iz = initialPos[i + 2];

                const tx = targetPos[i];
                const ty = targetPos[i + 1];
                const tz = targetPos[i + 2];

                // Nội suy tuyến tính (lerp) giữa vị trí ban đầu và đích
                positions[i] = THREE.MathUtils.lerp(ix, tx, easedProgress);
                positions[i + 1] = THREE.MathUtils.lerp(iy, ty, easedProgress);
                positions[i + 2] = THREE.MathUtils.lerp(iz, tz, easedProgress);
            }
            points.geometry.attributes.position.needsUpdate = true;
        }
    };
    return points;
}

// Hiệu ứng 14: Particle Attraction - Giữ lại từ trước
function createParticleAttractionEffect(imageData, width, height, centerX, centerY, scaleFactor, step) {
    const vertices = []; // Vị trí hiện tại (sẽ thay đổi)
    const colors = [];
    const velocities = []; // Vận tốc của từng hạt
    const targetPositionsData = []; // Vị trí đích (vị trí của pixel trong ảnh)

     // Tạo vị trí ban đầu ngẫu nhiên và vị trí đích (từ ảnh)
     for (let y = 0; y < height; y += step) {
         for (let x = 0; x < width; x += step) {
            const color = getPixelColor(imageData, width, x, y);
            if (color.a > 10) {
                // Vị trí đích (từ ảnh)
                const tx = (x - centerX) * scaleFactor;
                const ty = -(y - centerY) * scaleFactor;
                const tz = 0;
                targetPositionsData.push(tx, ty, tz);

                // Vị trí ban đầu ngẫu nhiên xa trung tâm
                 const maxDimScale = scaleFactor * Math.max(width, height);
                 const startX = (Math.random() - 0.5) * maxDimScale * 2;
                 const startY = (Math.random() - 0.5) * maxDimScale * 2;
                 const startZ = (Math.random() - 0.5) * maxDimScale * 2;
                vertices.push(startX, startY, startZ);

                // Vận tốc ban đầu bằng 0
                velocities.push(0, 0, 0);

                colors.push(color.r / 255, color.g / 255, color.b / 255);
            }
        }
     }
     console.log(`ParticleAttractionEffect: Tạo ${vertices.length / 3} hạt.`);
      if (vertices.length === 0) {
        console.warn("ParticleAttractionEffect: Không tìm thấy pixel đủ mờ để tạo hạt.");
        return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3)); // Vận tốc
    // Không cần targetPositions là attribute nếu chỉ dùng trong userData

    const material = new THREE.PointsMaterial({
        size: 2 * scaleFactor,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);

    points.userData = {
        targetPositions: new Float32Array(targetPositionsData), // Lưu vị trí đích
        time: 0,
        attractionForce: scaleFactor * 0.009, // Lực hút
        damping: 1.0, // Giảm xóc
        maxSpeed: scaleFactor * 2.0, // Tốc độ tối đa
        update: function() {
           const positions = points.geometry.attributes.position.array;
           const velocitiesArr = points.geometry.attributes.velocity.array;
           const targetPos = this.targetPositions;

           this.time++;

            const tempVector = new THREE.Vector3(); // Dùng để tính toán vector

            for (let i = 0; i < positions.length; i += 3) {
                const px = positions[i];
                const py = positions[i + 1];
                const pz = positions[i + 2];

                const tx = targetPos[i];
                const ty = targetPos[i + 1];
                const tz = targetPos[i + 2];

                // Tính vector hướng từ vị trí hiện tại đến vị trí đích
                tempVector.set(tx - px, ty - py, tz - pz);

                // Tính khoảng cách
                const distanceSq = tempVector.lengthSq(); // Khoảng cách bình phương nhanh hơn length()

                // Nếu hạt đủ gần đích, dừng lại hoặc giảm tốc độ
                if (distanceSq < (scaleFactor * 0.2) * (scaleFactor * 0.2)) { // Ngưỡng dừng
                    positions[i] = tx; // Snap to target
                    positions[i + 1] = ty;
                    positions[i + 2] = tz;
                    velocitiesArr[i] = 0; // Dừng hẳn
                    velocitiesArr[i + 1] = 0;
                    velocitiesArr[i + 2] = 0;
                } else {
                     // Tính lực hút (tăng khi gần, giảm khi xa - hoặc lực cố định)
                     // Đây là lực cố định nhân với hướng chuẩn hóa
                    tempVector.normalize().multiplyScalar(this.attractionForce);

                    // Cộng lực vào vận tốc
                    velocitiesArr[i] += tempVector.x;
                    velocitiesArr[i + 1] += tempVector.y;
                    velocitiesArr[i + 2] += tempVector.z;

                    // Giới hạn vận tốc
                     const speedSq = velocitiesArr[i] * velocitiesArr[i] + velocitiesArr[i + 1] * velocitiesArr[i + 1] + velocitiesArr[i + 2] * velocitiesArr[i + 2];
                     if (speedSq > this.maxSpeed * this.maxSpeed) {
                         const speed = Math.sqrt(speedSq);
                         velocitiesArr[i] = (velocitiesArr[i] / speed) * this.maxSpeed;
                         velocitiesArr[i + 1] = (velocitiesArr[i + 1] / speed) * this.maxSpeed;
                         velocitiesArr[i + 2] = (velocitiesArr[i + 2] / speed) * this.maxSpeed;
                     }
                }

                // Cập nhật vị trí dựa trên vận tốc
                positions[i] += velocitiesArr[i];
                positions[i + 1] += velocitiesArr[i + 1];
                positions[i + 2] += velocitiesArr[i + 2];

                // Áp dụng giảm xóc (luôn áp dụng để hiệu ứng mượt mà hơn)
                velocitiesArr[i] *= this.damping;
                velocitiesArr[i + 1] *= this.damping;
                velocitiesArr[i + 2] *= this.damping;
            }
            points.geometry.attributes.position.needsUpdate = true;
            points.geometry.attributes.velocity.needsUpdate = true;
        }
    };
    return points;
}


// --- KHỞI CHẠY ỨNG DỤNG ---
initThreeJS();
fileNameDisplay.textContent = 'Vui lòng chọn một file ảnh.';
loadingMessage.style.display = 'none';
errorMessage.style.display = 'none';