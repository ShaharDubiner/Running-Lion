//**************************************************************************************************************************************************************//
// Javascript assignment to draw a textured 3D virtual world with a movable camera - now with a point-light serving as the sun.
// NOTE: Classes and global variables extracted to their own seperate files.
//**************************************************************************************************************************************************************//
function onLoad(){
	// Retrieve <canvas> element.
	canvas = document.getElementById('canvas');
	// Get the rendering context for WebGL with alpha enabled.
	gl = canvas.getContext("webgl", {premultipliedAlpha: false});
	if(!gl){ console.error('Failed to get the rendering context for WebGL!'); return; }
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	// Horrible string replacement used to define array sizes in shaders using a variable.
	lightsTotal = 1;
	VSHADER_SOURCE = VSHADER_SOURCE.split('${lightsTotal}').join(''+lightsTotal);
	FSHADER_SOURCE = FSHADER_SOURCE.split('${lightsTotal}').join(''+lightsTotal);
	// Initialize shaders.
	if(!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)){ console.error('Failed to intialize shaders.'); return; }
	
	// Get the storage location of shader defined variables.
	a_Position = gl.getAttribLocation(gl.program, 'a_Position');
	if(a_Position < 0){ console.error('Failed to get the storage location of a_Position.'); return; }
	a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
	if(a_Normal < 0){ console.error('Failed to get the storage location of a_Normal.'); return; }
	a_Color = gl.getAttribLocation(gl.program, 'a_Color');
	if(a_Color < 0){ console.error('Failed to get the storage location of a_Color.'); return; }
	a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord');
	if(a_TexCoord < 0){ console.error('Failed to get the storage location of a_TexCoord.'); return; }
	
	u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
	if(!u_MvpMatrix){ console.error('Failed to get the storage location of u_MvpMatrix.'); return; }
	u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	if(!u_ModelMatrix){ console.error('Failed to get the storage location of u_ModelMatrix.'); return; }
	u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
	if(!u_NormalMatrix){ console.error('Failed to get the storage location of u_NormalMatrix.'); return; }
	
	u_CameraPosition = gl.getUniformLocation(gl.program, 'u_CameraPosition');
	if(!u_CameraPosition){ console.error('Failed to get the storage location of u_CameraPosition.'); return; }
	u_Textured = gl.getUniformLocation(gl.program, 'u_Textured');
	if(!u_Textured){ console.error('Failed to get the storage location of u_Textured.'); return; }
	u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
	gl.uniform1i(u_Textured, false); // Ensure default.
	if(!u_Sampler){ console.error('Failed to get the storage location of u_Sampler.'); return; }
	
	u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
	if(!u_AmbientLight){ console.error('Failed to get the storage location of u_AmbientLight.'); return; }
	u_AntiShinyness = gl.getUniformLocation(gl.program, 'u_AntiShinyness');
	if(!u_AntiShinyness){ console.error('Failed to get the storage location of u_AntiShinyness.'); return; }
	
	// Create the view projection matrix.
	viewProjMatrix = new Matrix4();
	// Camera(ID, loc, vel, target, tVel, renderMin, renderMax)
	camera = new Camera("PlayerView", [20.0, 10.0, 30.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0],
			1.0, 1000.0);
	camera.update(0);
	
	loadTextures();
	defineCube();
	defineSphere(10, 10);
	initShapes();
	
	// Set lighting.
	changeAmbientLight(0.2, 0.2, 0.2);
	lights.push(new Light("sun", [1.0, 1.0, 1.0], false, sun.loc));
	
	// Register the function to be called while a key is pressed.
	document.onkeydown = function(e){ keyDown(e); };
	// Register function to be called on mouse press.
	canvas.onmousedown = function(e){ mousePress(e); };
	// Register function to be called on mouse release.
	document.onmouseup = function(e){ mouseRelease(e); };
	// If page focus is lost, release mouse press.
	document.onblur = function(e){ mouseRelease(e); };
	// Register function to be called on mouse move.
	document.onmousemove = function(e){ mouseMove(e); };
	
	// Specify the color for clearing the canvas.
	gl.clearColor(0.0, 0.0, 0.0, 1.0); clear();
	// Enable 3D.
	gl.enable(gl.DEPTH_TEST);
	
	// Prep UI interface and functionality.
	initUIComponents();
	defaultUIValues();
	
	requestAnimationFrame(update);
	draw();
}
//**************************************************************************************************************************************************************//
function initUIComponents(){
	// Retrieve defaults button.
	defaultsButton = document.getElementById('defaultsButton');
	if(defaultsButton < 0){ console.error('Failed to find defaults button.'); return; }
	defaultsButton.onclick = function(){ defaultUIValues(); }
	// Retrieve color mode selection buttons.
	colorModeButtons = document.getElementsByName('colorMode');
	if(colorModeButtons < 0){ console.error('Failed to find color mode selection buttons.'); return; }
	// Retrieve sun's diffuse lighting switch.
	diffuseSwitchSun = document.getElementById('diffuseSwitchInputSun');
	if(diffuseSwitchSun < 0){ console.error('Failed to find sun\'s diffuse lighting switch.'); return; }
	// Retrieve sun's specular lighting switch.
	specularSwitchSun = document.getElementById('specularSwitchInputSun');
	if(specularSwitchSun < 0){ console.error('Failed to find sun\'s specular lighting switch.'); return; }
	
	// Retrieve sun's red selection slider.
	redSliderSun = document.getElementById('redSliderSun');
	if(redSliderSun < 0){ console.error('Failed to find sun\'s red selection slider.'); return; }
	redSliderSun.oninput = function(){
		lights[0].color[0] = this.value/255.0;
		if(redNumSun != null){ redNumSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's red selection numerical input box.
	redNumSun = document.getElementById('redNumSun');
	if(redNumSun < 0){ console.error('Failed to find sun\'s red selection numerical input box.'); return; }
	redNumSun.oninput = function(){
		if(this.validity.valid){ lights[0].color[0] = this.value/255.0; }
		else{ this.value = 255; lights[0].color[0] = 1.0; }
		if(redSliderSun != null){ redSliderSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's green selection slider.
	greenSliderSun = document.getElementById('greenSliderSun');
	if(greenSliderSun < 0){ console.error('Failed to find sun\'s green selection slider.'); return; }
	greenSliderSun.oninput = function(){
		lights[0].color[1] = this.value/255.0;
		if(greenNumSun != null){ greenNumSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's green selection numerical input box.
	greenNumSun = document.getElementById('greenNumSun');
	if(greenNumSun < 0){ console.error('Failed to find sun\'s green selection numerical input box.'); return; }
	greenNumSun.oninput = function(){
		if(this.validity.valid){ lights[0].color[1] = this.value/255.0; }
		else{ this.value = 255; lights[0].color[1] = 1.0; }
		if(greenSliderSun != null){ greenSliderSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's blue selection slider.
	blueSliderSun = document.getElementById('blueSliderSun');
	if(blueSliderSun < 0){ console.error('Failed to find sun\'s blue selection slider.'); return; }
	blueSliderSun.oninput = function(){
		lights[0].color[2] = this.value/255.0;
		if(blueNumSun != null){ blueNumSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's blue selection numerical input box.
	blueNumSun = document.getElementById('blueNumSun');
	if(blueNumSun < 0){ console.error('Failed to find sun\'s blue selection numerical input box.'); return; }
	blueNumSun.oninput = function(){
		if(this.validity.valid){ lights[0].color[2] = this.value/255.0; }
		else{ this.value = 255; lights[0].color[2] = 1.0; }
		if(blueSliderSun != null){ blueSliderSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's color display div.
	colorDisplaySun = document.getElementById('colorDisplaySun');
	if(colorDisplaySun < 0){ console.error('Failed to find sun\'s color display div.'); return; }
	// Retrieve sun's color picker element.
	colorPickerSun = document.getElementById('colorPickerSun');
	if(colorPickerSun < 0){ console.error('Failed to find sun\'s color picker.'); return; }
	colorPickerSun.onchange = function(){
		if(this.validity.valid){
			var rgb = hexToRgb(this.value);
			lights[0].color[0] = rgb[0]/255.0;
			if(redSliderSun != null){ redSliderSun.value = rgb[0]; }
			if(redNumSun != null){ redNumSun.value = rgb[0]; }
			lights[0].color[1] = rgb[1]/255.0;
			if(greenSliderSun != null){ greenSliderSun.value = rgb[1]; }
			if(greenNumSun != null){ greenNumSun.value = rgb[1]; }
			lights[0].color[2] = rgb[2]/255.0;
			if(blueSliderSun != null){ blueSliderSun.value = rgb[2]; }
			if(blueNumSun != null){ blueNumSun.value = rgb[2]; }
			colorDisplaySun.style.background = 'rgba('+rgb[0]+', '+rgb[1]+', '+rgb[2]+', 1.0)';
		}
		else{ this.value = colorDisplaySun.style.background; }
	}
	
	// Retrieve ambient red selection slider.
	redSliderAmbient = document.getElementById('redSliderAmbient');
	if(redSliderAmbient < 0){ console.error('Failed to find ambient red selection slider.'); return; }
	redSliderAmbient.oninput = function(){
		changeAmbientLight(this.value/255.0, ambientLight[1], ambientLight[2]);
		if(redNumAmbient != null){ redNumAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient red selection numerical input box.
	redNumAmbient = document.getElementById('redNumAmbient');
	if(redNumAmbient < 0){ console.error('Failed to find ambient red selection numerical input box.'); return; }
	redNumAmbient.oninput = function(){
		if(this.validity.valid){ changeAmbientLight(this.value/255.0, ambientLight[1], ambientLight[2]); }
		else{ this.value = 51; changeAmbientLight(0.2, ambientLight[1], ambientLight[2]); }
		if(redSliderAmbient != null){ redSliderAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient green selection slider.
	greenSliderAmbient = document.getElementById('greenSliderAmbient');
	if(greenSliderAmbient < 0){ console.error('Failed to find ambient green selection slider.'); return; }
	greenSliderAmbient.oninput = function(){
		changeAmbientLight(ambientLight[0], this.value/255.0, ambientLight[2]);
		if(greenNumAmbient != null){ greenNumAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient green selection numerical input box.
	greenNumAmbient = document.getElementById('greenNumAmbient');
	if(greenNumAmbient < 0){ console.error('Failed to find ambient green selection numerical input box.'); return; }
	greenNumAmbient.oninput = function(){
		if(this.validity.valid){ changeAmbientLight(ambientLight[0], this.value/255.0, ambientLight[2]); }
		else{ this.value = 51; changeAmbientLight(ambientLight[0], 0.2, ambientLight[2]); }
		if(greenSliderAmbient != null){ greenSliderAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient blue selection slider.
	blueSliderAmbient = document.getElementById('blueSliderAmbient');
	if(blueSliderAmbient < 0){ console.error('Failed to find ambient blue selection slider.'); return; }
	blueSliderAmbient.oninput = function(){
		changeAmbientLight(ambientLight[0], ambientLight[1], this.value/255.0);
		if(blueNumAmbient != null){ blueNumAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient blue selection numerical input box.
	blueNumAmbient = document.getElementById('blueNumAmbient');
	if(blueNumAmbient < 0){ console.error('Failed to find ambient blue selection numerical input box.'); return; }
	blueNumAmbient.oninput = function(){
		if(this.validity.valid){ changeAmbientLight(ambientLight[0], ambientLight[1], this.value/255.0); }
		else{ this.value = 51; changeAmbientLight(ambientLight[0], ambientLight[1], 0.2); }
		if(blueSliderAmbient != null){ blueSliderAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient color display div.
	colorDisplayAmbient = document.getElementById('colorDisplayAmbient');
	if(colorDisplayAmbient < 0){ console.error('Failed to find ambient color display div.'); return; }
	// Retrieve ambient color picker element.
	colorPickerAmbient = document.getElementById('colorPickerAmbient');
	if(colorPickerAmbient < 0){ console.error('Failed to find ambient color picker.'); return; }
	colorPickerAmbient.onchange = function(){
		if(this.validity.valid){
			var rgb = hexToRgb(this.value);
			changeAmbientLight(rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0);
			if(redSliderAmbient != null){ redSliderAmbient.value = rgb[0]; }
			if(redNumAmbient != null){ redNumAmbient.value = rgb[0]; }
			if(greenSliderAmbient != null){ greenSliderAmbient.value = rgb[1]; }
			if(greenNumAmbient != null){ greenNumAmbient.value = rgb[1]; }
			if(blueSliderAmbient != null){ blueSliderAmbient.value = rgb[2]; }
			if(blueNumAmbient != null){ blueNumAmbient.value = rgb[2]; }
			colorDisplayAmbient.style.background = 'rgba('+rgb[0]+', '+rgb[1]+', '+rgb[2]+', 1.0)';
		}
		else{ this.value = colorDisplayAmbient.style.background; }
	}
}
//**************************************************************************************************************************************************************//
// Load textures to be used.
function loadTextures(){
	textures.sky = loadTexture("./src/sky.jpg");
	textures.rock = loadTexture("./src/rock.jpg");
}
// Create cube archtype to be used.
function defineCube(){
	cube = new ShapeType("cube");
	// Cube vertices.
	var vertices = new Float32Array([
		 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5,-0.5, 0.5,  0.5,-0.5, 0.5, // v0-v1-v2-v3 front
		 0.5, 0.5, 0.5,  0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5, // v0-v3-v4-v5 right
		 0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5, -0.5, 0.5, 0.5, // v0-v5-v6-v1 up
		-0.5, 0.5, 0.5, -0.5, 0.5,-0.5, -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, // v1-v6-v7-v2 left
		-0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5, // v7-v4-v3-v2 down
		 0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5  // v4-v7-v6-v5 back
	]);
	cube.vertexBuffer = getArrayBuffer(vertices, 3, gl.FLOAT);
	// Cuboid normals.
	var normals = new Float32Array([
		 0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0, // v0-v1-v2-v3 front
		 1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0, // v0-v3-v4-v5 right
		 0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0, // v0-v5-v6-v1 up
		-1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, // v1-v6-v7-v2 left
		 0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0, // v7-v4-v3-v2 down
		 0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0  // v4-v7-v6-v5 back
	]);
	cube.normalsBuffer = getArrayBuffer(normals, 3, gl.FLOAT);
	// Special case for cuboids meant to be lit from the inside.
    for(var i = 0; i < normals.length; ++i){ normals[i] *= -1; }
	cube.normalsBufferInvert = getArrayBuffer(normals, 3, gl.FLOAT);
	// Cuboid vertex indices.
	var indices = new Uint8Array([
		 0, 1, 2,   0, 2, 3, // front
		 4, 5, 6,   4, 6, 7, // right
		 8, 9,10,   8,10,11, // up
		12,13,14,  12,14,15, // left
		16,17,18,  16,18,19, // down
		20,21,22,  20,22,23  // back
	]);
	cube.indicesBuffer = gl.createBuffer();
	if(!cube.indicesBuffer){ console.error('Failed to create buffer object.'); return null; }
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cube.indicesBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
	cube.indicesBuffer.len = indices.length;
	cube.indicesBuffer.type = gl.UNSIGNED_BYTE;
	// Cube texture mapping. Texture dimensions are normalized when used by WebGL.
	var textureMap = new Float32Array([
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // front
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // right
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // up
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // left
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // down
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0  // back
	]);
	cube.textureMap = getArrayBuffer(textureMap, 2, gl.FLOAT);
	// Cuboid color pallete.
	cube.colorBuffer = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 1.0, 1.0, 1.0, 1.0), 4, gl.FLOAT);
	cubeColors.ground = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.4, 0.6, 0.2, 1.0), 4, gl.FLOAT);
	cubeColors.lionFur = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.75, 0.55, 0.0, 1.0), 4, gl.FLOAT);
	cubeColors.lionFuzz = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.65, 0.45, 0.0, 1.0), 4, gl.FLOAT);
	cubeColors.lionMane = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.55, 0.35, 0.0, 1.0), 4, gl.FLOAT);
	cubeColors.lionTailTip = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.35, 0.2, 0.0, 1.0), 4, gl.FLOAT);
	cubeColors.lionSnoutTop = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.8, 0.6, 0.4, 1.0), 4, gl.FLOAT);
	cubeColors.lionSnoutBottom = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.95, 0.8, 0.7, 1.0), 4, gl.FLOAT);
	cubeColors.lionTongue = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 1.0, 0.1, 0.1, 1.0), 4, gl.FLOAT);
	cubeColors.lionNose = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.1, 0.1, 0.1, 1.0), 4, gl.FLOAT);
	cubeColors.lionEyes = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.1, 0.1, 0.1, 1.0), 4, gl.FLOAT);
}
// Create a sphere by iterating through its spherical coordinates and generating 2 triangles for each quad on one of its rings.
function defineSphere(hSteps, vSteps){
	sphere = new ShapeType("sphere");
	// Sphere vertices, normals, and texture mapping.
	var numVertices = (hSteps + 1)*(vSteps + 1);
	var vertices = [], normals = [], textureMap = [];
	for(var j = 0; j <= vSteps; ++j){
		var v = j/vSteps;
		var phi = Math.PI*v;
		var sinPhi = Math.sin(phi);
		var uy = Math.cos(phi);
		for(var i = 0; i <= hSteps; ++i){
			var u = i/hSteps;
			var theta = TWO_PI*u;
			var ux = Math.cos(theta)*sinPhi;
			var uz = Math.sin(theta)*sinPhi;
			// Generate data based on spherical coordinates. Radius is 0.5 to make a default size of 1.
			vertices.push(0.5*ux, 0.5*uy, 0.5*uz);
			normals.push(ux, uy, uz);
			textureMap.push(1.0 - u, v);
		}
	}
	sphere.vertexBuffer = getArrayBuffer(new Float32Array(vertices), 3, gl.FLOAT);
	sphere.normalsBuffer = getArrayBuffer(new Float32Array(normals), 3, gl.FLOAT);
	// Special case for spheres meant to be lit from the inside.
    for(var i = 0; i < normals.length; ++i){ normals[i] *= -1; }
	sphere.normalsBufferInvert = getArrayBuffer(new Float32Array(normals), 3, gl.FLOAT);
	sphere.textureMap = getArrayBuffer(new Float32Array(textureMap), 2, gl.FLOAT);
	
	// Sphere vertex indices.
	var numVertsAround = hSteps + 1;
    var indices = [];
    for(var i = 0; i < hSteps; ++i){
		for(var j = 0; j < vSteps; ++j){
			// Make triangle 1 of quad.
			indices.push(j*numVertsAround + i, j*numVertsAround + i+1, (j+1)*numVertsAround + i);
			// Make triangle 2 of quad.
			indices.push((j+1)*numVertsAround + i, j*numVertsAround + i+1, (j+1)*numVertsAround + i+1);
		}
	}
	sphere.indicesBuffer = gl.createBuffer();
	if(!sphere.indicesBuffer){ console.error('Failed to create buffer object.'); return null; }
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.indicesBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
	sphere.indicesBuffer.len = indices.length;
	sphere.indicesBuffer.type = gl.UNSIGNED_SHORT;
	// Sphere color pallete.
	sphere.colorBuffer = getArrayBuffer(vertexColors(sphere.vertexBuffer.len, 1.0, 1.0, 1.0, 1.0), 4, gl.FLOAT);
	sphereColors.orange = getArrayBuffer(vertexColors(sphere.vertexBuffer.len, 1.0, 0.5, 0.0, 1.0), 4, gl.FLOAT);
}
//**************************************************************************************************************************************************************//
// Create starting shapes and set up vertex buffering and normals.
function initShapes(){
	// Shape(ID, shapeType, size, loc, [rotations])
	/*var newShape = new Shape("core", cube, [10.0, 10.0, 2.0], [0.0, 0.0, 0.0], [[0.0, 1.0, 0.0, 0.0, 0.0, [0.0, 0.0, 0.0]]]);
	shapes.push(newShape);*/
	initShapesWorld();
	initShapesLion();
}
function initShapesWorld(){
	var sky = new Shape("skybox", sphere, [666.0, 666.0, 666.0], [0.0, 0.0, 0.0], []);
	sky.texture = textures.sky;
	sky.normalsBuffer = sphere.normalsBufferInvert;
	shapes.push(sky);
	sun = new Shape("sun", sphere, [30.0, 30.0, 30.0], [0.0, 10.0, -250], [[0.0, 1.0, 0.0, 0.0, 0.0, [0.0, 0.0, 0.0]]]);
	sun.colorBuffer = sphereColors.orange;
	sun.normalsBuffer = sphere.normalsBufferInvert;
	sun.vel = [0.0, 0.0, 0.0];
	shapes.push(sun);
	var ground = new Shape("ground", cube, [320.0, 2.0, 320.0], [0.0, -10.0, 0.0], [[35.0, 0.0, 1.0, 0.0, 0.0, [0.0, 0.0, 0.0]]]);
	ground.colorBuffer = cubeColors.ground;
	shapes.push(ground);
	var textureBall = new Shape("textureBall", sphere, [15.0, 15.0, 15.0], [-100.0, 30.0, 50.0], []);
	textureBall.texture = textures.sky;
	shapes.push(textureBall);
	var plainBall = new Shape("plainBall", sphere, [25.0, 25.0, 25.0], [-90.0, 10.0, 70.0], []);
	plainBall.colorBuffer = sphereColors.orange;
	shapes.push(plainBall);
	var normalBall = new Shape("normalBall", sphere, [20.0, 20.0, 20.0], [-120.0, 20.0, 60.0], []);
	normalBall.colorBuffer = sphere.normalsBuffer;
	shapes.push(normalBall);
	var wallMap = [[4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 3,  2, 3, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 2, 0, 1,  0, 2, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 4, 0, 1,  0, 3, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 2, 0, 0,  0, 3, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  2, 3, 3, 3, 3,  0, 3, 4, 4, 4,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  3, 0, 0, 0, 0,  0, 3, 4, 4, 4,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 1, 2, 3, 2,  2, 0, 1, 3, 2,  2, 3, 4, 4, 4,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 2,  1, 4, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 3,  0, 3, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 4,  1, 2, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4]];
	var halfX = wallMap.length/2, halfY = wallMap[0].length/2;
	for(var i = 0; i < wallMap.length; ++i){
		for(var j = 0; j < wallMap[i].length; ++j){
			var prevBlock = ground;
			for(var n = 0; n < wallMap[i][j]; ++n){
				var block = new Shape("block", cube, [10.0, 10.0, 10.0],
						(prevBlock == ground) ? [10.0*(i-halfX), 5.0, 10.0*(j-halfY)]:[0.0, 10.0, 0.0], []);
				block.texture = textures.rock;
				prevBlock.branches.push(block);
				prevBlock = block;
			}
		}
	}
}
function initShapesLion(){
	body1 = new Shape("body1", cube, [8.0, 8.0, 10.0], [35.0, 5.0, 0.0],
			[[0.0, 0.0, 1.0, 0.0, 0.0, [0.0, 0.0, 0.0]], [0.0, 1.0, 0.0, 0.0, 0.45, [0.0, 0.0, 0.0]]]);
	body1.colorBuffer = cubeColors.lionFur;
	body1.vel = [0.0, 0.0, 0.0];
	shapes.push(body1);
	body2 = new Shape("body2", cube, [6.0, 6.0, 10.0], [0.0, -0.3, -8.0], [[0.0, -1.0, 0.0, 0.0, 0.45, [0.0, 0.3, 0.0]]]);
	body2.colorBuffer = cubeColors.lionFur;
	body1.branches.push(body2);

	neck = new Shape("neck", cube, [3.5, 3.5, 5.0], [0.0, 2.0, 5.0], [[0.0, -1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	neck.colorBuffer = cubeColors.lionFur;
	body1.branches.push(neck);
	head = new Shape("head", cube, [5.0, 5.0, 4.0], [0.0, 0.25, 3.0], [[0.0, -1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	head.colorBuffer = cubeColors.lionFur;
	neck.branches.push(head);
	var snoutTop = new Shape("snoutTop", cube, [2.5, 1.0, 2.5], [0.0, -1.1, 3.0], []);
	snoutTop.colorBuffer = cubeColors.lionSnoutTop;
	head.branches.push(snoutTop);
	snoutBottom = new Shape("snoutBottom", cube, [2.5, 0.75, 2.5], [0.0, -2.0, 3.0], [[20.0, 1.0, 0.0, 0.0, 0.5, [0.0, 0.0, -0.5]]]);
	snoutBottom.colorBuffer = cubeColors.lionSnoutBottom;
	head.branches.push(snoutBottom);
	
	var tongue = new Shape("tongue", cube, [1.5, 0.5, 1.5], [0.0, 0.3, 0.0], []);
	tongue.colorBuffer = cubeColors.lionTongue;
	snoutBottom.branches.push(tongue);
	var nose = new Shape("nose", cube, [1.25, 0.5, 0.75], [0.0, 0.45, 1.0], []);
	nose.colorBuffer = cubeColors.lionNose;
	snoutTop.branches.push(nose);
	var leftEye = new Shape("leftEye", cube, [0.5, 0.5, 0.5], [1.1, 0.75, 2.0], []);
	leftEye.colorBuffer = cubeColors.lionEyes;
	head.branches.push(leftEye);
	var rightEye = new Shape("rightEye", cube, [0.5, 0.5, 0.5], [-1.1, 0.75, 2.0], []);
	rightEye.colorBuffer = cubeColors.lionEyes;
	head.branches.push(rightEye);
	var leftEar1 = new Shape("leftEar1", cube, [0.9, 1.0, 0.5], [1.75, 2.5, 1.3], []);
	leftEar1.colorBuffer = cubeColors.lionFur;
	head.branches.push(leftEar1);
	var leftEar2 = new Shape("leftEar2", cube, [0.6, 0.5, 0.4], [0.0, 0.75, 0.0], []);
	leftEar2.colorBuffer = cubeColors.lionFur;
	leftEar1.branches.push(leftEar2);
	var rightEar1 = new Shape("rightEar1", cube, [0.9, 1.0, 0.5], [-1.75, 2.5, 1.3], []);
	rightEar1.colorBuffer = cubeColors.lionFur;
	head.branches.push(rightEar1);
	var rightEar2 = new Shape("rightEar2", cube, [0.6, 0.5, 0.4], [0.0, 0.75, 0.0], []);
	rightEar2.colorBuffer = cubeColors.lionFur;
	rightEar1.branches.push(rightEar2);
	var mane = new Shape("mane", cube, [8.0, 8.0, 3.0], [0.0, -0.25, -0.5], []);
	mane.colorBuffer = cubeColors.lionMane;
	head.branches.push(mane);
	
	frontLegL1 = new Shape("frontLegL1", cube, [2.0, 5.0, 2.0], [3.5, -5.0, 3.5], [[0.0, 1.0, 0.0, 0.0, 2.5, [0.0, 1.0, 0.0]]]);
	frontLegL1.colorBuffer = cubeColors.lionFur;
	body1.branches.push(frontLegL1);
	frontLegL2 = new Shape("frontLegL2", cube, [1.75, 5.0, 1.75], [0.0, -4.0, 0.2], [[0.0, 1.0, 0.0, 0.0, 1.25, [0.0, 1.0, -0.2]]]);
	frontLegL2.colorBuffer = cubeColors.lionFur;
	frontLegL1.branches.push(frontLegL2);
	frontLegL3 = new Shape("frontLegL3", cube, [1.75, 2.0, 1.75], [0.0, -3.0, 0.1], [[0.0, 1.0, 0.0, 0.0, 1.25, [0.0, 0.0, 0.0]]]);
	frontLegL3.colorBuffer = cubeColors.lionFuzz;
	frontLegL2.branches.push(frontLegL3);

	frontLegR1 = new Shape("frontLegR1", cube, [2.0, 5.0, 2.0], [-3.5, -5.0, 3.5], [[0.0, 1.0, 0.0, 0.0, 2.5, [0.0, 1.0, 0.0]]]);
	frontLegR1.colorBuffer = cubeColors.lionFur;
	body1.branches.push(frontLegR1);
	frontLegR2 = new Shape("frontLegR2", cube, [1.75, 5.0, 1.75], [0.0, -4.0, 0.2], [[0.0, 1.0, 0.0, 0.0, 1.25, [0.0, 1.0, -0.2]]]);
	frontLegR2.colorBuffer = cubeColors.lionFur;
	frontLegR1.branches.push(frontLegR2);
	frontLegR3 = new Shape("frontLegR3", cube, [1.75, 2.0, 1.75], [0.0, -3.0, 0.1], [[0.0, 1.0, 0.0, 0.0, 1.25, [0.0, 0.0, 0.0]]]);
	frontLegR3.colorBuffer = cubeColors.lionFuzz;
	frontLegR2.branches.push(frontLegR3);
	
	backLegL1 = new Shape("backLegL1", cube, [1.75, 5.0, 3.0], [3.5, -2.0, -4.0], [[0.0, -1.0, 0.0, 0.0, 3.0, [0.0, 0.0, 0.0]]]);
	backLegL1.colorBuffer = cubeColors.lionFur;
	body2.branches.push(backLegL1);
	backLegL2 = new Shape("backLegL2", cube, [1.75, 4.0, 1.75], [0.0, -3.8, 0.5], [[0.0, -1.0, 0.0, 0.0, 0.5, [0.0, 3.8, -0.5]]]);
	backLegL2.colorBuffer = cubeColors.lionFur;
	backLegL1.branches.push(backLegL2);
	backLegL3 = new Shape("backLegL3", cube, [1.75, 4.0, 1.75], [0.0, -4.0, -0.1], [[0.0, -1.0, 0.0, 0.0, 0.5, [0.0, 4.0, 0.1]]]);
	backLegL3.colorBuffer = cubeColors.lionFur;
	backLegL2.branches.push(backLegL3);
	backLegL4 = new Shape("backLegL4", cube, [1.75, 2.0, 2.0], [0.0, -3.0, 0.1], [[0.0, -1.0, 0.0, 0.0, 1.0, [0.0, 3.0, -0.1]]]);
	backLegL4.colorBuffer = cubeColors.lionFuzz;
	backLegL3.branches.push(backLegL4);
	
	backLegR1 = new Shape("backLegR1", cube, [1.75, 5.0, 3.0], [-3.5, -2.0, -4.0], [[0.0, -1.0, 0.0, 0.0, 3.0, [0.0, 0.0, 0.0]]]);
	backLegR1.colorBuffer = cubeColors.lionFur;
	body2.branches.push(backLegR1);
	backLegR2 = new Shape("backLegR2", cube, [1.75, 4.0, 1.75], [0.0, -3.8, 0.5], [[0.0, -1.0, 0.0, 0.0, 0.5, [0.0, 3.8, -0.5]]]);
	backLegR2.colorBuffer = cubeColors.lionFur;
	backLegR1.branches.push(backLegR2);
	backLegR3 = new Shape("backLegR3", cube, [1.75, 4.0, 1.75], [0.0, -4.0, -0.1], [[0.0, -1.0, 0.0, 0.0, 0.5, [0.0, 4.0, 0.1]]]);
	backLegR3.colorBuffer = cubeColors.lionFur;
	backLegR2.branches.push(backLegR3);
	backLegR4 = new Shape("backLegR4", cube, [1.75, 2.0, 2.0], [0.0, -3.0, 0.1], [[0.0, -1.0, 0.0, 0.0, 1, [0.0, 3.0, -0.1]]]);
	backLegR4.colorBuffer = cubeColors.lionFuzz;
	backLegR3.branches.push(backLegR4);

	tail1 = new Shape("tail1", cube, [1.0, 1.0, 2.0], [0.0, 2.5, -5.0], [[0.0, 1.0, 0.0, 0.0, 1.0, [0.0, 0.0, 0.0]]]);
	tail1.colorBuffer = cubeColors.lionFur;
	body2.branches.push(tail1);
	tail2 = new Shape("tail2", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail2.colorBuffer = cubeColors.lionFur;
	tail1.branches.push(tail2);
	tail3 = new Shape("tail3", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail3.colorBuffer = cubeColors.lionFur;
	tail2.branches.push(tail3);
	tail4 = new Shape("tail4", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail4.colorBuffer = cubeColors.lionFur;
	tail3.branches.push(tail4);
	tail5 = new Shape("tail5", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail5.colorBuffer = cubeColors.lionFur;
	tail4.branches.push(tail5);
	tail6 = new Shape("tail6", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail6.colorBuffer = cubeColors.lionFur;
	tail5.branches.push(tail6);
	tail7 = new Shape("tail7", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail7.colorBuffer = cubeColors.lionFur;
	tail6.branches.push(tail7);
	tailTip = new Shape("tailTip", cube, [1.75, 1.75, 2.0], [0.0, 0.0, -1.0], [[0.0, 1.0, 0.0, 0.0, 0.0, [0.0, 0.0, -1.0]]]);
	tailTip.colorBuffer = cubeColors.lionTailTip;
	tail7.branches.push(tailTip);
}
//**************************************************************************************************************************************************************//
// Handle keyboard input.
function keyDown(e){
	switch(e.keyCode){
		// 'W', 'w' key. Move camera forward.
		case 87: case 119:
			camera.move(0.0, 0.0, MOVE_SPEED);
			break;
		// 'A', 'a' key. Move camera left.
		case 65: case 97:
			camera.move(-0.5*MOVE_SPEED, 0.0, 0.0);
			break;
		// 'S', 's' key. Move camera backward.
		case 83: case 115:
			camera.move(0.0, 0.0, -MOVE_SPEED);
			break;
		// 'D', 'd' key. Move camera right.
		case 68: case 100:
			camera.move(0.5*MOVE_SPEED, 0.0, 0.0);
			break;
		// 'E', 'e' key. Turn camera right.
		case 69: case 101:
			camera.turn(TURN_SPEED, 0);
			break;
		// 'Q', 'q' key. Turn camera left.
		case 81: case 113:
			camera.turn(-TURN_SPEED, 0);
			break;
		// 'X', 'x' key. Move camera up.
		case 88: case 120:
			camera.move(0.0, 0.5*MOVE_SPEED, 0.0);
			break;
		// 'Z', 'z' key. Move camera down.
		case 90: case 122:
			camera.move(0.0, -0.5*MOVE_SPEED, 0.0);
			break;
		// Skip redraw if nothing changed.
		default: return;
	}
	draw();
}
// Handle mouse input.
function mousePress(e){
	// Only left mouse button counts.
	if(e.buttons == 1){
		mouseLocPress[0] = e.pageX; mouseDisplace[0] = 0;
		mouseLocPress[1] = e.pageY; mouseDisplace[1] = 0;
		mouseDown = true;
	}
}
function mouseRelease(e){
	// Only left mouse button counts.
	if(e.buttons%2 != 1){
		mouseDown = false;
	}
}
function mouseMove(e){
	// Only left mouse button counts.
	if(e.buttons == 1){
		mouseDisplace[0] = e.pageX - mouseLocPress[0];
		mouseDisplace[1] = e.pageY - mouseLocPress[1];
		if(Math.abs(mouseDisplace[0]) < TURN_BUFFER){ mouseDisplace[0] = 0; }
		if(Math.abs(mouseDisplace[1]) < TURN_BUFFER){ mouseDisplace[1] = 0; }
	}
	else{
		mouseDown = false;
	}
}
//**************************************************************************************************************************************************************//
// Reset values controlled by the UI to their default values.
function defaultUIValues(){
	colorMode = "standard";
	if(colorModeButtons != null){
		for(var i = 0; i < colorModeButtons.length; ++i){
			if(colorModeButtons[i].value == colorMode){ colorModeButtons[i].checked = true; }
			else{ colorModeButtons[i].checked = false; }
		}
	}
	
	lights[0].diffuse = diffuseSwitchSun.checked = true;
	lights[0].specular = specularSwitchSun.checked = true;
	lights[0].color[0] = lights[0].color[1] = lights[0].color[2] = 1.0;
	if(redSliderSun != null){ redSliderSun.value = 255; }
	if(redNumSun != null){ redNumSun.value = 255; }
	if(greenSliderSun != null){ greenSliderSun.value = 255; }
	if(greenNumSun != null){ greenNumSun.value = 255; }
	if(blueSliderSun != null){ blueSliderSun.value = 255; }
	if(blueNumSun != null){ blueNumSun.value = 255; }
	if(colorDisplaySun != null){
		colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
		if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
	}
	
	changeAmbientLight(0.2, 0.2, 0.2);
	if(redSliderAmbient != null){ redSliderAmbient.value = 51; }
	if(redNumAmbient != null){ redNumAmbient.value = 51; }
	if(greenSliderAmbient != null){ greenSliderAmbient.value = 51; }
	if(greenNumAmbient != null){ greenNumAmbient.value = 51; }
	if(blueSliderAmbient != null){ blueSliderAmbient.value = 51; }
	if(blueNumAmbient != null){ blueNumAmbient.value = 51; }
	if(colorDisplayAmbient != null){
		colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
		if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
	}
}
// Change between color display modes.
function modeSelect(){
	if(colorModeButtons == null){ return; }
	// Find and set currently selected color mode.
	for(var i = 0; i < colorModeButtons.length; ++i){
		if(colorModeButtons[i].checked){
			colorMode = colorModeButtons[i].value;
			break;
		}
	}
}
function toggleDiffuse(){ if(diffuseSwitchSun == null){ return; } lights[0].diffuse = diffuseSwitchSun.checked; }
function toggleSpecular(){ if(specularSwitchSun == null){ return; } lights[0].specular = specularSwitchSun.checked; }
function changeAmbientLight(r, g, b){
	ambientLight[0] = r; ambientLight[1] = g; ambientLight[2] = b;
	gl.uniform3fv(u_AmbientLight, ambientLight);
}
//**************************************************************************************************************************************************************//
// Update program logic by the given number of ticks.
function update(){
	time = Date.now();
	var ticks = (time - lastTime)*fps/1000;
	if(ticks >= 1){
		camera.update(ticks);
		if(mouseDown){ camera.turn(ticks*TURN_SPEED_MOUSE*mouseDisplace[0], ticks*TURN_SPEED_MOUSE*mouseDisplace[1]); }
		
		ticks %= (turnTicks*2);
		// Sun movement.
		sun.rotations[0][0] = (sun.rotations[0][0] + SUN_TURN_SPEED*ticks) % 360;
		sun.vel[1] = Math.cos(sun.rotations[0][0]*RADIAN_CONVERT)*SUN_SPEED;
		sun.vel[2] = Math.sin(sun.rotations[0][0]*RADIAN_CONVERT)*SUN_SPEED;
		// Lion movement.
		body1.rotations[0][0] = (body1.rotations[0][0] + LION_TURN_SPEED*ticks) % 360;
		body1.vel[0] = Math.sin(body1.rotations[0][0]*RADIAN_CONVERT)*LION_SPEED;
		body1.vel[2] = Math.cos(body1.rotations[0][0]*RADIAN_CONVERT)*LION_SPEED;
		if(ticks+timer >= turnTicks){
			// Upadte all extant shapes by the given number of ticks.
			for(var i = 0; i < shapes.length; ++i){
				shapes[i].update(turnTicks-timer);
			}
			ticks -= turnTicks-timer;
			
			// Lion body animation cycle shift.
			body1.rotations[1][4] *= -1;
			body2.rotations[0][4] *= -1;
			head.rotations[0][4] *= -1;
			neck.rotations[0][4] *= -1;
			snoutBottom.rotations[0][4] *= -1;
			frontLegL1.rotations[0][4] *= -1;
			frontLegL2.rotations[0][4] *= -1;
			frontLegL3.rotations[0][4] *= -1;
			frontLegR1.rotations[0][4] *= -1;
			frontLegR2.rotations[0][4] *= -1;
			frontLegR3.rotations[0][4] *= -1;
			backLegL1.rotations[0][4] *= -1;
			backLegL2.rotations[0][4] *= -1;
			backLegL3.rotations[0][4] *= -1;
			backLegL4.rotations[0][4] *= -1;
			backLegR1.rotations[0][4] *= -1;
			backLegR2.rotations[0][4] *= -1;
			backLegR3.rotations[0][4] *= -1;
			backLegR4.rotations[0][4] *= -1;
			tail1.rotations[0][4] *= -1;
			tail2.rotations[0][4] *= -1;
			tail3.rotations[0][4] *= -1;
			tail4.rotations[0][4] *= -1;
			tail5.rotations[0][4] *= -1;
			tail6.rotations[0][4] *= -1;
			tail7.rotations[0][4] *= -1;
			
			// Upadte all extant shapes by the given number of ticks.
			for(var i = 0; i < shapes.length; ++i){
				shapes[i].update(ticks);
			}
			timer = ticks;
		}
		else{
			// Upadte all extant shapes by the given number of ticks.
			for(var i = 0; i < shapes.length; ++i){
				shapes[i].update(ticks);
			}
			timer += ticks;
		}
		draw();
		lastTime = time;
	}
	requestAnimationFrame(update);
}
// Draw current shapes to the canvas.
function draw(){
	clear();
	// Recalculate light positions.
	for(var i = 0; i < lights.length; ++i){ lights[i].draw(); }
	// Redraw all extant shapes to the canvas.
	for(var i = 0; i < shapes.length; ++i){
		brush.setIdentity();
		shapes[i].draw();
	}
}
//**************************************************************************************************************************************************************//
// Clear the canvas.
function clear(){
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
// Write the given data to a buffer and return it, but don't assign it to any attribute variables.
function getArrayBuffer(data, num, type){
	// Create a WebGL buffer.
	var buffer = gl.createBuffer();
	if(!buffer){ console.error('Failed to create buffer object.'); return null; }
	// Write given data into the buffer object.
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	// Store extra information used to assign the object to an attribute variable later.
	buffer.num = num;
	buffer.type = type;
	buffer.len = data.length/num;
	return buffer;
}
// Create and return a WebGL texture with the given source image.
function loadTexture(source){
	var texture = gl.createTexture();
	if(!texture){ console.error('Failed to create texture object.'); return null; }
	gl.bindTexture(gl.TEXTURE_2D, texture);
	
	var level = 0;
	var internalFormat = gl.RGBA, srcFormat = gl.RGBA, srcType = gl.UNSIGNED_BYTE;
	// Until the image is loaded put a single pixel in the texture as placeholder.
	var pixel = new Uint8Array([155, 0, 0, 255]);
	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, 1, 1, 0, srcFormat, srcType, pixel);
	
	var img = new Image();
	if(!img){ console.error('Failed to create image object.'); return null; }
	img.crossOrigin = "anonymous";
	img.onload = function(){
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, img);
		
		// WebGL1 has different requirements for images with dimensions that are both powers of 2.
		if(isPowerOf2(img.width) && isPowerOf2(img.height)){
			gl.generateMipmap(gl.TEXTURE_2D);
		}
		else{
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		}
		// Prevent a newly loaded texture from replacing the current one when only a single texture is being used.
		prevTexture = null;
	};
	// Load in the given image.
	img.src = source;
	return texture;
}
// Return a color array for the given number of vertices, initialized as the given color.
function vertexColors(vertexNum, r, g, b, a){
	a = a || 1.0; // Default alpha channel.
	vertexNum*=4;
	var colors = new Float32Array(vertexNum);
	for(var i = 0; i < vertexNum; i+=4){
		colors[i] = r; colors[i+1] = g; colors[i+2] = b; colors[i+3] = a;
	}
	return colors;
}
//**************************************************************************************************************************************************************//
// Converts hexadecimal color values to RGB format.
function hexToRgb(hex){
	// Use regexp to split hex. Every two digits or a-f are kept in one element of resuting array.
	var result = /^#?([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/i.exec(hex);
	var rgb = [];
	for(var i = 0; i < 3 && i+1 < result.length; ++i){
		rgb.push(parseInt(result[i+1], 16));
	}
	return rgb;
}
// Converts RGB color values to hexadecimal format.
function rgbToHex(r, g, b){
	return "#"+hex(r) + hex(g) + hex(b);
}
function hex(n){
	var hex = Number(n).toString(16);
	if(hex.length == 1){ return "0" + hex; }
	return hex;
}
// Returns whether or not the given number is a power of 2.
function isPowerOf2(n){ return (n & (n-1)) == 0; }
