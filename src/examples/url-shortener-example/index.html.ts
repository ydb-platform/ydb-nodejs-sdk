export const indexPageContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>shortener</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
    <script src="http://code.jquery.com/jquery-3.5.0.min.js" integrity="sha256-xNzN2a4ltkB44Mc/Jz3pT4iU1cmeR0FkXs4pru/JxaQ=" crossorigin="anonymous"></script>
    <style>
        body {
            margin-top: 30px;
        }
        .shorten {
             color: blue;
        }
    </style>
</head>
<body>

<div class="container">
  <div class="row-12">
    <form id="source-url-form">
      <div class="form-row">
        <div class="col-12">
          <input id="source" type="text" class="form-control" placeholder="https://">
        </div>
      </div>
    </form>
  </div>
  <div class="row-12">
    <p id="shorten" class="shorten"></p>
  </div>
</div>

<script>
    $(function() {
        let $form = $("#source-url-form");
        let $source = $("#source");
        let $shorten = $("#shorten");
        
        $form.submit(function(e) {
            e.preventDefault();
            
            $.ajax({
                url: "url",
                type: "post",
                data: JSON.stringify({source: $source.val()}),
                contentType: "application/json; charset=utf-8",
                traditional: true,
                success: function(data) {
                    $shorten.html(data);
                },
                error: function(data) {
                    $shorten.html('invalid url');
                }
            });
        });
    });
</script>

</body>
</html>`;
