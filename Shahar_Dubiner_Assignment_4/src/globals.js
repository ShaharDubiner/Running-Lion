//**************************************************************************************************************************************************************//
// Global variables used in 'lighting.js'.
//**************************************************************************************************************************************************************//
// Number of lights the shader can handle.
var lightsTotal = 1;
// Vertex shader program.
var VSHADER_SOURCE =
	'attribute vec4 a_Position, a_Normal, a_Color;\n'+
	'attribute vec2 a_TexCoord;\n'+
	
	'uniform mat4 u_MvpMatrix, u_ModelMatrix, u_NormalMatrix;\n'+
	'uniform vec3 u_CameraPosition, u_ShapePosition;\n'+
	'uniform vec3 u_LightLocOrDir[${lightsTotal}];\n'+
	'uniform bool u_LightIsDirectional[${lightsTotal}];\n'+
	'uniform bool u_Textured;\n'+
	
	'varying vec3 v_Normal, v_ToView;\n'+
	'varying vec3 v_ToLight[${lightsTotal}];\n'+
	'varying vec4 v_Color;\n'+
	'varying vec2 v_TexCoord;\n'+
	'void main(){\n'+
		// Apply model + view point matrix to base position.
	'	gl_Position = u_MvpMatrix * a_Position;\n'+
		// Orient the normals and pass result to the fragment shader.
	'	v_Normal = vec3(u_NormalMatrix * a_Normal);\n'+
		
		// Compute the position of this surface.
	'	vec3 surfacePosition = (u_ModelMatrix * a_Position).xyz;\n'+
		// Compute the vector from the surface to the user camera and pass it to the fragment shader.
	'	v_ToView = u_CameraPosition - surfacePosition;\n'+
		// Compute the vectors from the surface to the lights and pass them to the fragment shader. Makes point lights handle as directional.
	'	for(int i = 0; i < ${lightsTotal}; ++i){\n'+
	'		if(u_LightIsDirectional[i]){ v_ToLight[i] = normalize(u_LightLocOrDir[i]); }\n'+
	'		else{ v_ToLight[i] = normalize(u_LightLocOrDir[i] - surfacePosition); }\n'+
	'	}\n'+
		
		// Pass texture data to fragment shader.
	'	if(u_Textured){ v_TexCoord = a_TexCoord; }\n'+
		// Pass color data to fragment shader.
	'	else{ v_Color = a_Color; }\n'+
	'}\n';
// Fragment shader program.
var FSHADER_SOURCE =
	'#ifdef GL_ES\n'+
	'	precision mediump float;\n'+
	'#endif\n'+
	'uniform vec3 u_AmbientLight;\n'+
	'uniform vec3 u_LightColor[${lightsTotal}];\n'+
	'uniform float u_AntiShinyness;\n' +
	'uniform bool u_Textured;\n'+
	'uniform bool u_DiffuseLight[${lightsTotal}], u_SpecularLight[${lightsTotal}];\n'+
	'uniform sampler2D u_Sampler;\n'+
	
	'varying vec3 v_Normal, v_ToView;\n'+
	'varying vec3 v_ToLight[${lightsTotal}];\n'+
	'varying vec4 v_Color;\n'+
	'varying vec2 v_TexCoord;\n'+
	'void main(){\n'+
		// Because varying variables are interpolated, make sure they're normalized where expected.
	'	vec3 normal = normalize(v_Normal);\n'+
	'	vec3 toView = normalize(v_ToView);\n'+
		
		// Calculate incoming light.
	'	vec3 diffuse = u_AmbientLight, specular = vec3(0.0, 0.0, 0.0);\n'+
	'	for(int i = 0; i < ${lightsTotal}; ++i){\n'+
	'		if(u_DiffuseLight[i]){ diffuse += max(dot(normal, v_ToLight[i]), 0.0) * u_LightColor[i]; }\n'+
	'		if(u_SpecularLight[i]){ specular += pow(max(dot(normal, normalize(normalize(v_ToLight[i]) + toView)), 0.0), u_AntiShinyness) * u_LightColor[i]; }\n'+
	'	}\n'+
		
		// Finalize pixel color with material texture or simple color.
	'	if(u_Textured){\n'+
	'		vec4 texelColor = texture2D(u_Sampler, v_TexCoord);\n'+
	'		gl_FragColor = vec4(specular + texelColor.rgb*diffuse, texelColor.a);\n'+
	'	}\n'+
	'	else{ gl_FragColor = vec4(specular + v_Color.rgb*diffuse, v_Color.a); }\n'+
	'}\n';
//**************************************************************************************************************************************************************//
// Global variables.
var gl = null;
var canvas = null;
var time = Date.now(), lastTime = time, fps = 60;
// Trackers to prevent setting values that didn't change.
var prevVertices = null, prevNormals = null, prevIndices = null, prevColors = null, prevTexture = null, prevTextureMap = null, wasTexture = false;
// Shader variables.
var a_Position = null, a_Normal = null, a_Color = null, a_TexCoord = null;
var u_MvpMatrix = null, u_modelMatrix = null, u_NormalMatrix = null;
var u_CameraPosition = null, u_Textured = null, u_Sampler = null;
var u_AmbientLight = null, u_AntiShinyness = null, u_DiffuseLight = null, u_SpecularLight = null;
// var u_LightLocOrDir = null, u_LightIsDirectional = null, u_LightColor = null;

// Textures.
var textures = [];
// Universal shape archtypes.
var cube = null, sphere = null;
var cubeColors = [], sphereColors = [];
// Root shapes which do not branch off from others.
var shapes = [];
// Specific shapes to keep track of.
var body1 = null, body2 = null, neck = null, head = null, snoutBottom = null;
var frontLegL1 = null, frontLegL2 = null, frontLegL3 = null;
var frontLegR1 = null, frontLegR2 = null, frontLegR3 = null;
var backLegL1 = null, backLegL2 = null, backLegL3 = null, backLegL4 = null;
var backLegR1 = null, backLegR2 = null, backLegR3 = null, backLegR4 = null;
var tail1 = null, tail2 = null, tail3 = null, tail4 = null, tail5 = null, tail6 = null, tail7 = null;
var sun = null;

// Camera object.
var camera = null;
// User viewing matrix.
var viewProjMatrix = null;
// Light sources. Length should be exactly 'lightsTotal'.
var lights = [];
var ambientLight = [0.0, 0.0, 0.0];
// Current transformation matrices.
var brush = new Matrix4(), brushResized = new Matrix4(), tempMatrix = new Matrix4();
// Transformation matrix history.
var brushStates = [];

// Animation frame timers.
var timer = 20, turnTicks = 40;
// Mouse tracking variables.
var mouseDown = false;
var mouseDisplace = [0, 0], mouseLocPress = [0, 0];

// User controls.
var defaultsButton = null;
var colorModeButtons = null;
var colorMode = "standard";
var diffuseSwitchSun = null, specularSwitchSun = null;
var redSliderSun = null, redNumSun = null, greenSliderSun = null, greenNumSun = null, blueSliderSun = null, blueNumSun = null;
var redSliderAmbient = null, redNumAmbient = null, greenSliderAmbient = null, greenNumAmbient = null, blueSliderAmbient = null, blueNumAmbient = null;
var colorPickerSun = null, colorDisplaySun = null, colorPickerAmbient = null, colorDisplayAmbient = null;

// Constants.
const TWO_PI = 2*Math.PI, RADIAN_CONVERT = Math.PI/180.0;
const MOVE_SPEED = 1.0, TURN_SPEED = 0.5, TURN_SPEED_MOUSE = 0.001, TURN_BUFFER = 10.0;
const LION_SPEED = 0.5, LION_TURN_SPEED = 0.5, SUN_SPEED = 1.3, SUN_TURN_SPEED = 0.3;
//**************************************************************************************************************************************************************//