//**************************************************************************************************************************************************************//
// Class structures used in 'lighting.js'.
//**************************************************************************************************************************************************************//
// Class definition for the viewpoint camera.
function Camera(_id, _loc, _vel, _target, _tVel, _renderMin, _renderMax){
	this.id = _id;										// Text ID.
	this.loc = _loc; this.vel = _vel;					// Camera position and its change per update tick.
	this.target = _target; this.tVel = _tVel;			// Camera focus point and its change per update tick.
	this.renderMin = _renderMin;						// Minimum rendering distance.
	this.renderMax = _renderMax;						// Maximum rendering distance.
	this.up = [0.0, 1.0, 0.0];							// Vector declaring which way is up relative to the camera.
	this.aRatio = canvas.width/canvas.height;			// Aspect ratio of the frustum.
	// Update this camera object for the given number of animation ticks.
	this.update = function(ticks){
		this.loc[0] += ticks*this.vel[0];
		this.loc[1] += ticks*this.vel[1];
		this.loc[2] += ticks*this.vel[2];
		
		this.target[0] += ticks*this.tVel[0];
		this.target[1] += ticks*this.tVel[1];
		this.target[2] += ticks*this.tVel[2];
		// 1: Angle between the upper and lower sides of the frustum.
		// 2: Aspect ratio of the frustum.
		// 3: Distance to the nearest depth clipping plane. Must be positive.
		// 3: Distance to the farthest depth clipping plane. Must be positive.
		viewProjMatrix.setPerspective(60.0, this.aRatio, this.renderMin, this.renderMax);
		// 1, 2, 3: Camera location.
		// 4, 5, 6: Location the camera is looking at.
		// 7, 8, 9: Vector declaring which way is up relative to the camera.
		viewProjMatrix.lookAt(this.loc[0], this.loc[1], this.loc[2],
							  this.target[0], this.target[1], this.target[2],
							  this.up[0], this.up[1], this.up[2]);
		gl.uniform3fv(u_CameraPosition, this.loc);
	}
	// Move this camera object according to the current perspective's vectors by the given amounts.
	this.move = function(x, y, z){
		var view = viewProjMatrix.elements;
		// Left/Right
		if(x != 0){
			this.loc[0] += x*view[0]; this.loc[1] += x*view[4]; this.loc[2] += x*view[8];
			this.target[0] += x*view[0]; this.target[1] += x*view[4]; this.target[2] += x*view[8];
		}
		// Up/Down
		if(y != 0){
			this.loc[0] += y*view[1]; this.loc[1] += y*view[5]; this.loc[2] += y*view[9];
			this.target[0] += y*view[1]; this.target[1] += y*view[5]; this.target[2] += y*view[9];
		}
		// Forward/Backward
		if(z != 0){
			this.loc[0] += z*view[2]; this.loc[1] += z*view[6]; this.loc[2] += z*view[10];
			this.target[0] += z*view[2]; this.target[1] += z*view[6]; this.target[2] += z*view[10];
		}
	}
	// Turn this camera object according to the current perspective's vectors by the given amounts.
	this.turn = function(x, y){
		var view = viewProjMatrix.elements;
		// Left/Right
		if(x != 0){
			this.target[0] += x*view[0]; this.target[1] += x*view[4]; this.target[2] += x*view[8];
		}
		// Up/Down
		if(y != 0){
			this.target[0] -= y*view[1]; this.target[1] -= y*view[5]; this.target[2] -= y*view[9];
		}
	}
}
//**************************************************************************************************************************************************************//
// Class definition for a point/directional light.
function Light(_id, _color, _isDir, _locOrDir){
	this.id = _id;										// Text ID.
	this.isDir = _isDir;								// Boolean. True if a directional light, false if a point light.
	this.locOrDir = _locOrDir;							// Light direction if directional, light position if a point light.
	this.color = _color;								// Light color.
	this.diffuse = true, this.specular = true;			// Booleans for turning on/off lighting components.
	
	// Permanently connect this light to the next slot in the shader arrays. Exactly 'lightsTotal' lights should be made.
	this.i = lights.length;
	this.u_LightLocOrDir = gl.getUniformLocation(gl.program, 'u_LightLocOrDir['+this.i+']');
	if(!this.u_LightLocOrDir){ console.error('Failed to get the storage location of u_LightLocOrDir['+this.i+'].'); return; }
	this.u_LightIsDirectional = gl.getUniformLocation(gl.program, 'u_LightIsDirectional['+this.i+']');
	if(!this.u_LightIsDirectional){ console.error('Failed to get the storage location of u_LightIsDirectional['+this.i+'].'); return; }
	this.u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor['+this.i+']');
	if(!this.u_LightColor){ console.error('Failed to get the storage location of u_LightColor['+this.i+'].'); return; }
	this.u_DiffuseLight = gl.getUniformLocation(gl.program, 'u_DiffuseLight['+this.i+']');
	if(!this.u_DiffuseLight){ console.error('Failed to get the storage location of u_DiffuseLight['+this.i+'].'); return; }
	this.u_SpecularLight = gl.getUniformLocation(gl.program, 'u_SpecularLight['+this.i+']');
	if(!this.u_SpecularLight){ console.error('Failed to get the storage location of u_SpecularLight['+this.i+'].'); return; }
	
	// Pass this light's current data to the shader.
	this.draw = function(){
		gl.uniform1i(this.u_DiffuseLight, this.diffuse);
		gl.uniform1i(this.u_SpecularLight, this.specular);
		
		gl.uniform3fv(this.u_LightLocOrDir, this.locOrDir);
		gl.uniform1i(this.u_LightIsDirectional, this.isDir);
		gl.uniform3fv(this.u_LightColor, this.color);
	}
}
//**************************************************************************************************************************************************************//
// Simple container to define Shapes more easily. None of its values should remain null when a ShapeType is fully built.
function ShapeType(_id){
	this.id = _id;										// Text ID.
	this.vertexBuffer = null;							// WebGL buffer containing shape vertices.
	this.normalsBuffer = null;							// WebGL buffer containing shape normals.
	this.indicesBuffer = null;							// WebGL buffer indicating which vertices triangles are drawn between.
	this.colorBuffer = null;							// WebGL buffer containing vertex colors.
	this.textureMap = null;								// Mapping of the texture to shape vertices.
}
// Class definition for a 3D shape to be drawn.
function Shape(_id, _shapeType, _size, _loc, _rotations){
	this.id = _id;										// Text ID.
	this.vertexBuffer = _shapeType.vertexBuffer;		// WebGL buffer containing shape vertices.
	this.normalsBuffer = _shapeType.normalsBuffer;		// WebGL buffer containing shape normals.
	this.indicesBuffer = _shapeType.indicesBuffer;		// WebGL buffer indicating which vertices triangles are drawn between.
	this.colorBuffer = _shapeType.colorBuffer;			// WebGL buffer containing vertex colors.
	this.texture = null;								// Optional texture data to override color buffer.
	this.textureMap = _shapeType.textureMap;			// Mapping of the texture to shape vertices.
	this.antiShiny = 120.0;								// Exponent for specular lighting. Helps avoid excessive shinyness.
	
	this.size = _size; this.growth = null;				// Scaling matrix and its change per update tick.
	this.loc = _loc; this.vel = null;					// Translation matrix and its change per update tick.
	this.rotations = _rotations;						// Bundled rotation matrices, their change per update tick, and their center of rotation.
	this.branches = [];									// Array of shapes branching off from this one. They will remain connected and follow it as it moves.
	// Update this shape (and all branching shapes) for the given number of animation ticks.
	this.update = function(ticks){
		if(this.growth != null){
			this.size[0] += ticks*this.growth[0];
			this.size[1] += ticks*this.growth[1];
			this.size[2] += ticks*this.growth[2];
		}
		if(this.vel != null){
			this.loc[0] += ticks*this.vel[0];
			this.loc[1] += ticks*this.vel[1];
			this.loc[2] += ticks*this.vel[2];
		}
		
		for(var i = 0; i < this.rotations.length; ++i){
			var rotate = this.rotations[i];
			rotate[0] = (rotate[0] + ticks*rotate[4])%360;
		}
		
		for(var i = 0; i < this.branches.length; ++i){
			this.branches[i].update(ticks);
		}
	}
	// Draw this shape (and all branching shapes).
	this.draw = function(){
		// Apply location and rotation transforms to brush.
		brush.translate(this.loc[0], this.loc[1], this.loc[2]);
		if(this.rotations.length > 0){
			for(var i = 0; i < this.rotations.length; ++i){
				var rotate = this.rotations[i];
				brush.translate(rotate[5][0], rotate[5][1], rotate[5][2]);
				brush.rotate(rotate[0], rotate[1], rotate[2], rotate[3]);
				brush.translate(-rotate[5][0], -rotate[5][1], -rotate[5][2]);
			}
		}
		
		// Assign vertex buffer to WebGL.
		if(this.vertexBuffer != prevVertices){
			// Bind the WebGL buffer object to this shape's vertex buffer.
			gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
			// Assign the vertex buffer object to the vertex shader's position variable.
			// 1: Shader attribute to assign to.
			// 2: Number of components per vertex (1-4).
			// 3: Datatype enum. [gl.BYTE, gl.SHORT, gl.UNSIGNED_BYTE, gl.UNSIGNED_SHORT, gl.FLOAT, gl.HALF_FLOAT]
			// 4: Normalization boolean (forces non-float data to a -1 to 1 range if enabled).
			// 5: Data stride. Specifies the offset in bytes (0-255) between the beginning of consecutive vertex attributes.
			// 6: Offset in bytes of the first element in the vertex attribute array. Must be a multiple of the byte length of the datatype.
			gl.vertexAttribPointer(a_Position, this.vertexBuffer.num, this.vertexBuffer.type, false, 0, 0);
			// Enable the above assignment.
			gl.enableVertexAttribArray(a_Position);
			prevVertices = this.vertexBuffer;
		}
		// Assign vertex indices to the WebGL element array buffer object. Informs which vertices triangles are drawn between.
		if(this.indicesBuffer != prevIndices){
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer);
			prevIndices = this.indicesBuffer;
		}
		// Normals.
		if(this.normalsBuffer != prevNormals){
			gl.bindBuffer(gl.ARRAY_BUFFER, this.normalsBuffer);
			gl.vertexAttribPointer(a_Normal, this.normalsBuffer.num, this.normalsBuffer.type, false, 0, 0);
			gl.enableVertexAttribArray(a_Normal);
			prevNormals = this.normalsBuffer;
		}
		// Textures.
		if(this.textureMap != prevTextureMap){
			gl.bindBuffer(gl.ARRAY_BUFFER, this.textureMap);
			gl.vertexAttribPointer(a_TexCoord, this.textureMap.num, this.textureMap.type, false, 0, 0);
			gl.enableVertexAttribArray(a_TexCoord);
			prevTextureMap = this.textureMap;
		}
		if(colorMode == "standard"){
			if(this.texture != null){
				if(!wasTexture){ wasTexture = true; gl.uniform1i(u_Textured, true); }
				if(this.texture != prevTexture){
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, this.texture);
					gl.uniform1i(u_Sampler, 0);
					prevTexture = this.texture;
				}
			}
			// Colors.
			else if(wasTexture){ wasTexture = false; gl.uniform1i(u_Textured, false); }
			if(this.colorBuffer != prevColors){
				gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
				gl.vertexAttribPointer(a_Color, this.colorBuffer.num, this.colorBuffer.type, false, 0, 0);
				gl.enableVertexAttribArray(a_Color);
				prevColors = this.colorBuffer;
			}
		}
		// Special visualizations overriding standard color/texture.
		else{
			var col = this.colorBuffer;
			switch(colorMode){
				case "normals": col = this.normalsBuffer; break;
				case "vertices": col = this.vertexBuffer; break;
				case "textureMap": col = this.textureMap; break;
				case "standard": default: col = this.colorBuffer; break;
			}
			if(col != prevColors){
				gl.bindBuffer(gl.ARRAY_BUFFER, col);
				gl.vertexAttribPointer(a_Color, col.num, col.type, false, 0, 0);
				gl.enableVertexAttribArray(a_Color);
				prevColors = col;
			}
		}
		// Glare protection. (:
		gl.uniform1f(u_AntiShinyness, this.antiShiny);
		
		// Calculate the model position matrix and pass it to u_ModelMatrix.
		brushResized.set(brush);
		brushResized.scale(this.size[0], this.size[1], this.size[2]);
		gl.uniformMatrix4fv(u_ModelMatrix, false, brushResized.elements);
		// Calculate the model view projection matrix and pass it to u_MvpMatrix.
		tempMatrix.set(viewProjMatrix);
		tempMatrix.multiply(brushResized);
		gl.uniformMatrix4fv(u_MvpMatrix, false, tempMatrix.elements);
		// Calculate the matrix for normal and pass it to u_NormalMatrix.
		tempMatrix.setInverseOf(brushResized);
		tempMatrix.transpose();
		gl.uniformMatrix4fv(u_NormalMatrix, false, tempMatrix.elements);
		// Draw this shape.
		gl.drawElements(gl.TRIANGLES, this.indicesBuffer.len, this.indicesBuffer.type, 0);
		// Draw shapes branching from this one.
		brushStates.push(new Matrix4(brush));
		for(var i = 0; i < this.branches.length; ++i){
			brush.set(brushStates[brushStates.length-1]);
			this.branches[i].draw();
		}
		brush = brushStates.pop();
	}
}
//**************************************************************************************************************************************************************//