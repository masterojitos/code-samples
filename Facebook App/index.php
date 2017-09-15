<?php
require_once 'config.php';
function base64_url_decode($input) {
    return base64_decode(strtr($input, '-_', '+/'));
}
function parse_signed_request($signed_request) {
    list($encoded_sig, $payload) = explode('.', $signed_request, 2);
    $secret = $cusquena_config['webapp_secret'];
    $sig = base64_url_decode($encoded_sig);
    $data = json_decode(base64_url_decode($payload), true);
    $expected_sig = hash_hmac('sha256', $payload, $secret, $raw = true);
    if ($sig !== $expected_sig) {
        error_log('Bad Signed JSON signature!');
        return null;
    }
    return $data;
}
if (isset($_REQUEST['signed_request'])) {
    $signed_request = parse_signed_request($_REQUEST['signed_request']);
    $liked_page = $signed_request['page']['liked'];
} else {
    $liked_page = true;
}
?>
<!DOCTYPE html>
<!--[if lt IE 7]>      <html lang="es" class="no-js lt-ie9 lt-ie8 lt-ie7"> <![endif]-->
<!--[if IE 7]>         <html lang="es" class="no-js lt-ie9 lt-ie8"> <![endif]-->
<!--[if IE 8]>         <html lang="es" class="no-js lt-ie9"> <![endif]-->
<!--[if gt IE 8]><!--> <html lang="es" class="no-js"> <!--<![endif]-->
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title><?php echo $cusquena_config['title_page']; ?></title>
        <meta name="description" content="<?php echo $cusquena_config['title_description']; ?>" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="<?php echo $cusquena_config['title_page']; ?>" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="<?php echo $cusquena_config['website_url']; ?>" />
        <meta property="og:image" content="<?php echo $cusquena_config['website_url']; ?>img/oktoberfest.jpg" />
        <meta property="og:description" content="<?php echo $cusquena_config['title_description']; ?>" />
        <meta property="og:site_name" content="<?php echo $cusquena_config['site_name']; ?>" />
        <meta property="og:locale" content="es_LA" />
        <meta property="fb:app_id" content="<?php echo $cusquena_config['webapp_id']; ?>" />

        <link type="text/plain" rel="author" href="humans.txt" />

        <link rel="stylesheet" href="css/normalize.css" />
        <link rel="stylesheet" href="css/nanoscroller.css" />
        <link rel="stylesheet" href="css/friends_selector.css" />
        <link rel="stylesheet" href="css/main.css" />
        <link rel="stylesheet" href="css/sprite.css" />
        <link rel="stylesheet" href="css/fonts.css" />
        <link rel="stylesheet" href="css/custom.css" />
            
        <script src="//cdnjs.cloudflare.com/ajax/libs/modernizr/2.8.3/modernizr.min.js"></script>
        <script>window.Modernizr || document.write('<script src="js/vendor/modernizr-2.8.3.min.js"><\/script>');</script>
    </head>
    <body>
        <!--[if lt IE 8]>
            <p class="browsehappy">Estás usando un navegador <strong>desactualizado</strong>. Por favor <a href="http://browsehappy.com/">actualiza tu navegador</a> para mejorar tu experiencia.</p>
        <![endif]-->

        <a href="#" class="cusquena-icon boton-que-gano<?php if (!$liked_page) { echo ' hidden'; } ?>" id="boton_que_gano"></a>
        <div class="container">
            <main>
                <section class="section-no-fan<?php if ($liked_page) { echo ' hidden'; } ?>">
                    <div class="space"></div>
                    <article>
                        <img src="img/logo.png" alt="OKTOBERFEST CUSQUEÑA" class="top-logo" width="250" height="201" />
                        <span class="enunciado">PARA CONCURSAR<br />POR UNA</span>
                        <img src="img/mesa-roja.png" alt="MESA ROJA" class="mesa-roja" width="369" height="145" />
                        <span class="enunciado">PRIMERO DEBES<br />SER FAN!</span>
                    </article>
                    <footer>
                        DALE <span class="enunciado">&ldquo;ME GUSTA&rdquo;</span><br />A NUESTRO FAN PAGE
                    </footer>
                </section>
                <section class="section-fan">
                    <div class="space"></div>
                    <article>
                        <img src="img/mesa-roja-cusquena.png" alt="MESA ROJA" class="top-logo" width="393" height="210" />
                        <span class="enunciado">ARMA TU<br />COMITIVA Y GANA</span><br />
                        <span class="enunciado white">LA MEJOR MESA DE</span><br />
                        <span class="enunciado">OKTOBERFEST</span>
                    </article>
                    <footer>
                        <a href="#" class="cusquena-icon boton-participa" id="boton_participa"></a>
                    </footer>
                </section>
                <section class="section-formulario">
                    <div class="space"></div>
                    <article>
                        <img src="img/mesa-roja-cusquena.png" alt="MESA ROJA" class="top-logo" width="393" height="210" />
                        <div class="text-center">
                            <span class="enunciado">COMPLETA TUS DATOS</span><br />
                        </div>
                        <form id="formulario_datos_personales">
                            <div class="cusquena-input">
                                <label>Nombres:</label>
                                <div>
                                    <div class="border"></div>
                                    <input type="text" name="nombre" maxlength="80" />
                                </div>
                            </div>
                            <div class="cusquena-input">
                                <label>Apellido Paterno:</label>
                                <div>
                                    <div class="border"></div>
                                    <input type="text" name="apellido_paterno" maxlength="80" />
                                </div>
                            </div>
                            <div class="cusquena-input">
                                <label>Apellido Materno:</label>
                                <div>
                                    <div class="border"></div>
                                    <input type="text" name="apellido_materno" maxlength="80" />
                                </div>
                            </div>
                            <div class="cusquena-input">
                                <label>Fecha de Nacimiento:</label>
                                <div>
                                    <div class="border dia"></div>
                                    <input type="text" name="dia" class="dia" placeholder="DD" maxlength="2" />
                                    <div class="border mes"></div>
                                    <input type="text" name="mes" class="mes" placeholder="MM" maxlength="2" />
                                    <div class="border ano"></div>
                                    <input type="text" name="ano" class="ano" placeholder="AAAA" maxlength="4" />
                                </div>
                            </div>
                            <div class="cusquena-input">
                                <label>DNI:</label>
                                <div>
                                    <div class="border"></div>
                                    <input type="text" name="dni" maxlength="8" />
                                </div>
                            </div>
                            <div class="cusquena-input">
                                <label>Correo Electrónico:</label>
                                <div>
                                    <div class="border"></div>
                                    <input type="text" name="email" />
                                </div>
                            </div>
                            <div class="cusquena-input">
                                <label>Celular:</label>
                                <div>
                                    <div class="border"></div>
                                    <input type="text" name="cell" maxlength="9" />
                                </div>
                            </div>
                            <div class="terminos">
                                <div class="error"></div><br />
                                <div>
                                    <i class="check_button" id="terminos_check"></i><span>ACEPTO </span><a href="#" class="boton-terminos-y-condiciones">Términos y Condiciones</a>
                                </div>
                                <div>
                                    <i class="check_button" id="noticias_check"></i><span>ACEPTO </span>Recibir noticias por email y SMS
                                </div>
                            </div>
                        </form>
                    </article>
                    <footer>
                        <a href="#" class="cusquena-icon boton-siguiente" id="boton_siguiente"></a>
                    </footer>
                </section>
                <section id="mesa_roja" class="section-mesa-roja">
                    <div class="space"></div>
                    <img src="img/mesa-roja-cusquena.png" alt="MESA ROJA" class="top-logo" width="393" height="210" />
                    <article class="elegir-amigos">
                        <span class="enunciado">ELIGE A TUS 7 AMIGOS</span><br />
                        <span>PARA DISFRUTAR DE LA MEJOR</span><br />
                        <strong>FIESTA CERVECERA DEL MUNDO</strong><br /><br />
                        <a href="#" class="cusquena-icon boton-elegir" id="boton_elegir"></a>
                    </article>
                    <article class="hidden colocar-nombre">
                        <span class="enunciado">¿CÓMO LLAMAMOS A TU MESA ROJA?</span><br />
                        <div class="cusquena-input">
                            <div>
                                <div class="border"></div>
                                <input type="text" name="name" id="nombre_mesa" placeholder="   Escribe el nombre aqui" maxlength="30" />
                            </div>
                        </div>
                    </article>
                    <div id="user_picture" class="imagen-recuadro amigo-1"></div>
                    <div class="imagen-recuadro amigo-2">
                        <a href="#" class="cusquena-icon boton-eliminar eliminar-amigo hidden"></a>
                        <a href="#" class="cusquena-icon boton-escoger agregar-amigo hidden"></a>
                    </div>
                    <div class="imagen-recuadro amigo-3">
                        <a href="#" class="cusquena-icon boton-eliminar eliminar-amigo hidden"></a>
                        <a href="#" class="cusquena-icon boton-escoger agregar-amigo hidden"></a>
                    </div>
                    <div class="imagen-recuadro amigo-4">
                        <a href="#" class="cusquena-icon boton-eliminar eliminar-amigo hidden"></a>
                        <a href="#" class="cusquena-icon boton-escoger agregar-amigo hidden"></a>
                    </div>
                    <div class="imagen-recuadro amigo-5">
                        <a href="#" class="cusquena-icon boton-eliminar eliminar-amigo hidden"></a>
                        <a href="#" class="cusquena-icon boton-escoger agregar-amigo hidden"></a>
                    </div>
                    <div class="imagen-recuadro amigo-6">
                        <a href="#" class="cusquena-icon boton-eliminar eliminar-amigo hidden"></a>
                        <a href="#" class="cusquena-icon boton-escoger agregar-amigo hidden"></a>
                    </div>
                    <div class="imagen-recuadro amigo-7">
                        <a href="#" class="cusquena-icon boton-eliminar eliminar-amigo hidden"></a>
                        <a href="#" class="cusquena-icon boton-escoger agregar-amigo hidden"></a>
                    </div>
                    <div class="imagen-recuadro amigo-8">
                        <a href="#" class="cusquena-icon boton-eliminar eliminar-amigo hidden"></a>
                        <a href="#" class="cusquena-icon boton-escoger agregar-amigo hidden"></a>
                    </div>
                    <footer>
                        <a href="#" class="cusquena-icon boton-un-paso-mas-inactivo hidden" id="boton_unpasomas_inactivo"></a>
                        <a href="#" class="cusquena-icon boton-un-paso-mas hidden" id="boton_unpasomas"></a>
                        <a href="#" class="cusquena-icon boton-regresar hidden" id="boton_regresar"></a>
                        <a href="#" class="cusquena-icon boton-listo-inactivo hidden" id="boton_listo_inactivo"></a>
                        <a href="#" class="cusquena-icon boton-listo hidden" id="boton_listo"></a>
                    </footer>
                </section>
                <section class="section-inscrito">
                    <article>
                        <span class="enunciado little">YA ESTÁS PARTICIPANDO</span><br/>
                        <span class="enunciado little">EN TU MESA</span><br/>
                        <span class="enunciado white" id="nombre_ingresado">"CAMPEONES"</span><br/>
                    </article>
                    <footer>
                        <a href="#" class="cusquena-icon boton-comparte-el-concurso" id="boton_compartir"></a>
                    </footer>
                </section>
                <section class="section-terminos-y-condiciones">
                    <div class="space"></div>
                    <article>
                        <img class="top-logo" src="img/mesa-roja-cusquena.png" alt="MESA ROJA" width="393" height="210" />
                        <span class="enunciado">TERMINOS Y CONDICIONES</span><br />
                        <div id="scroll_terminos_y_condiciones" class="scroll nano">
                            <div class="nano-content">
                                <h3 style="text-decoration:underline;">BASES DEL CONCURSO</h3>
                                <p>
                                El participante deberá ingresar sus datos completos para quedar registrado. Escogerá siete (7) de
                                sus contactos en Facebook para llenar una mesa virtual (Mesa Roja). Al completarla entrará al
                                sorteo.
                                </p>
                                <h3 style="text-decoration:underline;"><strong>PREMIOS</strong></h3>
                                <ul>
                                    <li>
                                        <strong>Para el viernes 17/10</strong>
                                        <p>Cuatro (04) premios conformados cada uno por 8 entradas para el evento Oktoberfest
                                        Perú, 8 tickets de Comida y 32 vasos de Cerveza Cusqueña Roja de 25oz gratis en el
                                        Oktoberfest.</p>
                                    </li>
                                    <li>
                                        <strong>Para el sábado 18/10</strong>
                                        <p>Cuatro (04) premios conformados cada uno por 8 entradas para el evento Oktoberfest
                                        Perú, 8 tickets de Comida y 32 vasos de Cerveza Cusqueña Roja de 25oz gratis en el
                                        Oktoberfest.</p>
                                    </li>
                                </ul>
                                <h3 style="text-decoration:underline;"><strong>CONDICIONES Y/O RESTRICCIONES</strong></h3>
                                <ul>
                                    <li>Fecha de finalización: 13 de octubre de 2014.</li>
                                    <li>Fecha de sorteo: 14 de octubre de 2014 a las 16:00 horas.</li>
                                    <li>Son ocho (08) los ganadores. Cuatro (04) recibirán los premios del viernes 17/10 y el resto
                                        (04) del sábado 18/10.</li>
                                    <li>Cada consumidor tendrá una (01) oportunidad de participar.</li>
                                    <li>No participan menores de edad.</li>
                                    <li>Los ganadores tienen un plazo de hasta el 16 de octubre del 2014 a las 18:00 pm para
                                        reclamar el premio, de lo contrario se pondrá a disposición de la Oficina Nacional de
                                        Gobierno Interior.</li>
                                </ul>
                            </div>
                        </div>
                    </article>
                    <footer>
                        <a href="#" class="cusquena-icon boton-cerrar" id="boton-cerrar"></a>
                    </footer>
                </section>
                <section class="section-que-gano">
                    <div class="space"></div>
                    <article>
                        <img class="top-logo" src="img/mesa-roja-cusquena.png" alt="MESA ROJA" width="393" height="210" />
                        <span class="enunciado">¿QUÉ GANO?</span><br /><br />
                        <span class="enunciado white">Una mesa roja reservada</span><br />
                        <span class="enunciado">en el OKTOBERFEST</span>
                        <ul class="premios">
                            <li><span>&bull;</span><strong>8 entradas</strong> para el festival</li>
                            <li><span>&bull;</span><strong>8 tickets</strong> de comida</li>
                            <li><span>&bull;</span><strong>32 vasos</strong> de <strong>Cusqueña Roja</strong></li>
                            <li><span>&bull;</span>kit <strong>Oktoberfest</strong></li>
                        </ul>
                    </article>
                    <footer>
                        <a href="#" class="cusquena-icon boton-cerrar" id="boton-cerrar"></a>
                    </footer>
                </section>
            </main>
            <footer>
                <h3>TOMAR BEBIDAS ALCOHÓLICAS <br/>EN EXCESO ES DAÑINO</h3>
                <hr />
                <img src="img/logo.png" alt="OKTOBERFEST CUSQUEÑA" width="168" height="135" />
                <p>Esta promoción no guarda ningún tipo de relación directa 
                    o indirecta con Facebook, Compañias afiliadas, Filiales 
                    de la misma o Subsidiarias. De la misma manera, Facebook 
                    no patrocina, endosa o administra directa o indirectamente 
                    esta promoción. Todas las preguntas concernientes a la 
                    misma deberán ser remitidas directamente a MARCA y NO a 
                    Facebook. La informacion recolectada a través de esta 
                    promoción se realiza de manera independiente a Facebook 
                    con fines exclusivos de identificación, al entregarla, 
                    el usuario acepta los términos y condiciones establecidos 
                    para la misma. Todas las marcas registradas son propiedad 
                    de sus respectivos dueños.</p>
            </footer>
        </div>
        <div id="fb-root"></div>

        <script src="//ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>
        <script>window.jQuery || document.write('<script src="js/vendor/jquery-1.11.1.min.js"><\/script>');</script>
        <script src="//cdnjs.cloudflare.com/ajax/libs/jquery.nanoscroller/0.8.4/javascripts/jquery.nanoscroller.min.js"></script>
        <script>$.fn.nanoScroller || document.write('<script src="js/vendor/jquery.nanoscroller.min.js"><\/script>');</script>
        <script src="js/vendor/jquery.friend.selector-1.2.1.min.js"></script>
        <script src="js/config.js"></script>
        <script src="js/main.js"></script>
        <a href="#" class="bt-fs-dialog hidden"></a>
    </body>
</html>
